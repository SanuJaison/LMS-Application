import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { SalaryRequest } from '@/models/salaryRequest';
import { Employee } from '@/models/employee';
import {
  andFilter,
  getScope,
  requireAuth,
  scopeFilter,
} from '@/lib/apiAuth';
import { requireAdmin } from '@/lib/adminAuth';
import { displayStatus } from '@/lib/workflowStatus';
import { syncMonthlySalaries } from '@/lib/salarySync';
import { logActivity, causerFromRequest } from '@/lib/activityLog';

/**
 * GET /api/salary/requests
 * Returns the monthly auto-credited salary records (₹5,000 fixed base for SM, ASM, and BDE,
 * automatically adjusted for leaves taken, and editable by Admin).
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const { searchParams } = new URL(req.url);

    // Ensure all active SM, ASM, and BDE employees have their monthly ₹5,000 salary
    // auto-credited and leave deductions up to date.
    await syncMonthlySalaries(searchParams.get('period') || undefined);

    const scope = await getScope(auth);
    const mineParam = (searchParams.get('mine') || '').trim().toLowerCase();
    const filters: Record<string, any>[] = [];

    if (mineParam === 'true' || mineParam === '1') {
      filters.push({
        $or: [
          ...(auth.employeeId ? [{ employee_id: auth.employeeId }] : []),
          ...(auth.name ? [{ employee_name: auth.name }] : []),
        ],
      });
    } else if (!auth.isAdmin && auth.role !== 'SM' && auth.role !== 'MD') {
      filters.push(
        scopeFilter(scope, {
          idFields: ['employee_id', 'asm_id', 'sm_id'],
          nameFields: ['employee_name', 'asm_name', 'sm_name'],
        })
      );
    }

    if (auth.isAdmin || auth.role === 'SM' || auth.role === 'ASM' || auth.role === 'BDM') {
      const employeeId = (searchParams.get('employee_id') || '').trim();
      if (employeeId) filters.push({ employee_id: employeeId });
    }

    const statusParam = searchParams.get('status');
    if (statusParam) {
      const label = statusParam.toLowerCase();
      if (['pending', 'approved', 'paid', 'rejected'].includes(label)) {
        if (label === 'pending') {
          filters.push({
            status: { $nin: ['Approved', 'Paid', 'Rejected'] },
          });
        } else if (label === 'approved') {
          filters.push({ status: 'Approved' });
        } else if (label === 'paid') {
          filters.push({ status: 'Paid' });
        } else {
          filters.push({ status: 'Rejected' });
        }
      } else {
        filters.push({ status: statusParam });
      }
    }

    const requests = await SalaryRequest.find(andFilter(...filters))
      .sort({ createdAt: -1 })
      .lean();

    const data = requests.map((r: any) => ({
      ...r,
      base_salary: r.base_salary ?? 5000,
      leave_days: r.leave_days ?? 0,
      deduction: r.deduction ?? Math.max(0, (r.base_salary ?? 5000) - (r.amount ?? 5000)),
      status_label: displayStatus(r.status),
    }));

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error: any) {
    console.error('GET /api/salary/requests error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch salary records' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/salary/requests
 * Allows Admin to edit an employee's monthly salary (e.g. decreasing salary based on leaves taken,
 * editing leave_days, base_salary, net amount, or remarks).
 */
export async function PUT(req: Request) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;

    await connectDB();

    const body = await req.json().catch(() => ({}));
    const id = body.id || body._id;
    const requestId = body.request_id;

    if (!id && !requestId) {
      return NextResponse.json(
        { success: false, message: 'Salary record ID or request_id is required' },
        { status: 400 }
      );
    }

    const existing: any = await SalaryRequest.findOne({
      $or: [
        ...(id && /^[0-9a-fA-F]{24}$/.test(String(id)) ? [{ _id: id }] : []),
        ...(requestId ? [{ request_id: requestId }] : []),
      ],
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'Salary record not found' },
        { status: 404 }
      );
    }

    const baseSalary =
      body.base_salary !== undefined && !isNaN(Number(body.base_salary))
        ? Math.max(0, Number(body.base_salary))
        : Number(existing.base_salary ?? 5000);

    const leaveDays =
      body.leave_days !== undefined && !isNaN(Number(body.leave_days))
        ? Math.max(0, Number(body.leave_days))
        : Number(existing.leave_days ?? 0);

    const calculatedDeduction = Math.round((baseSalary / 30) * leaveDays);
    const calculatedNet = Math.max(0, baseSalary - calculatedDeduction);

    // If Admin explicitly changed `amount`, use it; otherwise if Admin changed `leave_days` or `base_salary`, use calculatedNet.
    let netAmount = calculatedNet;
    if (body.amount !== undefined && !isNaN(Number(body.amount))) {
      const providedAmount = Math.max(0, Number(body.amount));
      const leavesChanged =
        body.leave_days !== undefined &&
        Number(body.leave_days) !== Number(existing.leave_days ?? 0);
      if (!leavesChanged || providedAmount !== Number(existing.amount)) {
        netAmount = providedAmount;
      }
    }

    const deduction = Math.max(0, baseSalary - netAmount);
    const attendanceDays = Math.max(0, 30 - leaveDays);
    const status = body.status || existing.status || 'Paid';
    const remarks =
      body.remarks !== undefined
        ? String(body.remarks)
        : leaveDays > 0
          ? `Base ₹${baseSalary} − ₹${deduction} (${leaveDays} leave day(s)) = ₹${netAmount}`
          : existing.remarks || `Fixed ₹${baseSalary} monthly salary`;

    const resetAuto = body.manual_override === false;

    existing.base_salary = baseSalary;
    existing.leave_days = leaveDays;
    existing.deduction = deduction;
    existing.amount = netAmount;
    existing.attendance_days = attendanceDays;
    existing.status = status;
    existing.remarks = remarks;
    existing.manual_override = !resetAuto;

    if (!Array.isArray(existing.approval_history)) {
      existing.approval_history = [];
    }
    existing.approval_history.push({
      step: 'Admin Salary Adjustment',
      actor: 'Administrator',
      role: 'ADMIN',
      action: 'UPDATED_SALARY',
      remarks: `Updated net salary to ₹${netAmount} (Base: ₹${baseSalary}, Leaves: ${leaveDays} days, Deduction: ₹${deduction})`,
      timestamp: new Date(),
    });

    await existing.save();

    if (existing.employee_id) {
      await Employee.updateOne(
        { employee_id: existing.employee_id },
        { $set: { salary: netAmount } }
      );
    }

    await logActivity({
      description: `Updated monthly salary for ${existing.employee_name} (${existing.employee_id}) to ₹${netAmount} (Leaves: ${leaveDays})`,
      subjectType: 'Salary Request',
      causer: causerFromRequest(req),
    });

    return NextResponse.json({
      success: true,
      message: `Salary for ${existing.employee_name} updated to ₹${netAmount}.`,
      data: {
        ...existing.toObject(),
        status_label: displayStatus(existing.status),
      },
    });
  } catch (error: any) {
    console.error('PUT /api/salary/requests error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update salary' },
      { status: 500 }
    );
  }
}
