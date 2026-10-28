import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';
import { TaskTemplate } from '@/models/taskTemplate';
import { EmployeeTask } from '@/models/employeeTask';
import { Employee } from '@/models/employee';

// Helper to format date like "Aug 19, 2026"
function formatPeriodDate(date: Date = new Date()): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export async function POST(req: NextRequest) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;

    await connectDB();

    // 1. Fetch all active templates
    const activeTemplates = await TaskTemplate.find({ is_active: true });
    if (activeTemplates.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No active task templates found' },
        { status: 400 }
      );
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

    for (const template of activeTemplates) {
      // Find employees matching designation (or all if designation matches)
      const matchingEmployees = employees.filter(
        (emp) =>
          !template.designation ||
          emp.designation?.toLowerCase().trim() === template.designation.toLowerCase().trim()
      );

      // If no exact designation match, fallback to all BDEs or all employees
      const targetEmployees =
        matchingEmployees.length > 0
          ? matchingEmployees
          : employees.filter((e) =>
              e.designation?.toLowerCase().includes('executive') ||
              e.designation?.toLowerCase().includes('bde')
            );

      for (const emp of (targetEmployees.length > 0 ? targetEmployees : employees)) {
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

    return NextResponse.json({
      success: true,
      generatedCount,
      message:
        generatedCount > 0
          ? `Generated ${generatedCount} tasks for active employees!`
          : `Tasks for today (${todayStr}) are already up to date.`,
    });
  } catch (error) {
    console.error('Error generating tasks:', error);
    return NextResponse.json({ message: 'Failed to generate tasks' }, { status: 500 });
  }
}
