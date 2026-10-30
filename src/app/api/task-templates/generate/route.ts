import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';
import { causerFromRequest, logActivity } from '@/lib/activityLog';
import { todayKey } from '@/lib/employeeAuth';
import { TaskTemplate } from '@/models/taskTemplate';
import { EmployeeTask } from '@/models/employeeTask';
import { Employee } from '@/models/employee';

// Helper to format the period date like "Aug 19, 2026" in IST
function formatPeriodDate(): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [year, month, day] = todayKey().split('-').map(Number);
  return `${months[month - 1]} ${day}, ${year}`;
}

/**
 * Intelligent designation matching between employee and template designation
 */
function matchesDesignation(empDesignation: string, templateDesignation: string): boolean {
  if (!templateDesignation || !templateDesignation.trim()) return true;
  const emp = (empDesignation || '').toLowerCase().trim();
  const tpl = (templateDesignation || '').toLowerCase().trim();

  if (emp === tpl) return true;
  if (emp.includes(tpl) || tpl.includes(emp)) return true;

  // BDE / Business Development Executive
  const isBdeTpl = tpl.includes('bde') || tpl.includes('executive') || tpl.includes('business development');
  const isBdeEmp = emp.includes('bde') || emp.includes('executive') || emp.includes('business development');
  if (isBdeTpl && isBdeEmp && !tpl.includes('manager') && !emp.includes('manager')) return true;

  // ASM / Area Sales Manager
  const isAsmTpl = tpl.includes('asm') || tpl.includes('area sales');
  const isAsmEmp = emp.includes('asm') || emp.includes('area sales');
  if (isAsmTpl && isAsmEmp) return true;

  // SM / Sales Manager / State Manager
  const isSmTpl = tpl.includes('sales manager') || tpl.includes('state manager') || tpl === 'sm';
  const isSmEmp = emp.includes('sales manager') || emp.includes('state manager') || emp === 'sm';
  if (isSmTpl && isSmEmp && !tpl.includes('area') && !emp.includes('area')) return true;

  // BDM / Business Development Manager
  const isBdmTpl = tpl.includes('bdm') || tpl.includes('business development manager') || tpl.includes('bussiness developement manager');
  const isBdmEmp = emp.includes('bdm') || emp.includes('business development manager') || emp.includes('bussiness developement manager');
  if (isBdmTpl && isBdmEmp) return true;

  return false;
}

export async function POST(req: NextRequest) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;

    await connectDB();

    const body = await req.json().catch(() => ({}));
    const rawIds: string[] = Array.isArray(body.template_ids)
      ? body.template_ids
      : Array.isArray(body.templateIds)
        ? body.templateIds
        : body.template_id
          ? [body.template_id]
          : body.id
            ? [body.id]
            : [];

    // 1. Fetch targeted templates (or all active if none specified)
    let targetTemplates: any[] = [];

    if (rawIds.length > 0) {
      const objectIds = rawIds.filter((id) => /^[0-9a-fA-F]{24}$/.test(id));
      targetTemplates = await TaskTemplate.find({
        $or: [
          { _id: { $in: objectIds } },
          { id: { $in: rawIds } },
          { title: { $in: rawIds } },
        ],
      });

      if (targetTemplates.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Selected task template(s) not found' },
          { status: 404 }
        );
      }
    } else {
      targetTemplates = await TaskTemplate.find({ is_active: true });
      if (targetTemplates.length === 0) {
        return NextResponse.json(
          { success: false, message: 'No active task templates found' },
          { status: 400 }
        );
      }
    }

    // 2. Fetch all active employees
    const employees = await Employee.find({ status: { $regex: /^active$/i } });
    if (employees.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No active employees found to generate tasks for' },
        { status: 400 }
      );
    }

    const todayStr = formatPeriodDate();
    let generatedCount = 0;

    for (const template of targetTemplates) {
      // Find employees matching designation
      const matchingEmployees = template.designation
        ? employees.filter((emp) => matchesDesignation(emp.designation, template.designation))
        : employees;

      for (const emp of matchingEmployees) {
        // Check if task already exists for this employee, template, and period
        const existing = await EmployeeTask.findOne({
          employee: emp.name,
          task_template: template.title,
          period_start: todayStr,
        });

        if (existing) {
          continue; // Already generated for this period
        }

        // Calculate carry-over from previous period if enabled
        let carryOverTarget = 0;
        if (template.is_carry_over) {
          const lastTask = await EmployeeTask.findOne({
            employee: emp.name,
            task_template: template.title,
          }).sort({ createdAt: -1 });

          if (lastTask && !lastTask.is_completed) {
            carryOverTarget = Math.max(0, lastTask.total_target - lastTask.achieved);
          }
        }

        const totalTarget = template.target_count + carryOverTarget;

        await EmployeeTask.create({
          employee: emp.name,
          employee_id: emp.employee_id || `EMP-${Date.now().toString().slice(-4)}`,
          task_template: template.title,
          period_start: todayStr,
          period_end: todayStr,
          total_target: totalTarget,
          achieved: 0,
          is_completed: false,
          metric_type: template.metric_type,
        });

        generatedCount++;
      }
    }

    if (generatedCount > 0) {
      await logActivity({
        description: `Generated ${generatedCount} employee task${generatedCount === 1 ? '' : 's'}`,
        subjectType: 'Task',
        causer: causerFromRequest(req),
      });
    }

    const isSingle = targetTemplates.length === 1;
    const templateLabel = isSingle ? `"${targetTemplates[0].title}"` : `${targetTemplates.length} templates`;

    let message = '';
    if (generatedCount > 0) {
      message = isSingle
        ? `Generated ${generatedCount} task(s) for ${templateLabel}!`
        : `Generated ${generatedCount} tasks across ${templateLabel} for active employees!`;
    } else {
      message = `Tasks for ${templateLabel} for today (${todayStr}) are already generated.`;
    }

    return NextResponse.json({
      success: true,
      generatedCount,
      message,
    });
  } catch (error) {
    console.error('Error generating tasks:', error);
    return NextResponse.json({ message: 'Failed to generate tasks' }, { status: 500 });
  }
}
