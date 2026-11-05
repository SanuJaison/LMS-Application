import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { SalaryRequest } from '@/models/salaryRequest';
import { Employee } from '@/models/employee';
import { requireEmployee } from '@/lib/apiAuth';
import { logActivity, causerFromRequest } from '@/lib/activityLog';

/**
 * POST /api/salary/request
 * Submits a monthly minimum salary request (₹5,000 minimum) for the
 * signed-in employee. Body employee fields are ignored.
 */
export async function POST(req: Request) {
  try {
    await connectDB();

    const guard = await requireEmployee(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const employee = auth.employee;
    const body = await req.json().catch(() => ({}));

    const employeeName = auth.name;
    const employeeId = auth.employeeId;
    const team = employee?.team || '';
    const asmId = employee?.reports_to || '';

    let asmName = '';
    if (asmId) {
      const asmEmp: any = await Employee.findOne({ employee_id: asmId }).lean();
      if (asmEmp) asmName = asmEmp.name;
    }

    const defaultSalary =
      employee?.salary && Number(employee.salary) >= 5000
        ? Number(employee.salary)
        : 5000;
    const amount = Number(body.amount ?? defaultSalary);
    if (amount < 5000) {
      return NextResponse.json(
        {
          success: false,
          message: 'Validation failed: Minimum salary request is ₹5,000.',
        },
        { status: 400 }
      );
    }

    const currentMonth = new Date().toLocaleString('default', {
      month: 'long',
      year: 'numeric',
    });
    const period = body.period || currentMonth;

    const existing = await SalaryRequest.findOne({
      employee_id: employeeId,
      period,
      status: { $nin: ['Rejected'] },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message: `A salary request for ${period} already exists (Status: ${existing.status}).`,
        },
        { status: 400 }
      );
    }

    const requestId = `SAL-${Math.floor(1000 + Math.random() * 9000)}`;

    const isSm = auth.role === 'SM';
    const isAsm = auth.role === 'ASM' || auth.role === 'BDM';

    const initialStatus = isSm
      ? 'Forwarded to Accounts'
      : isAsm
        ? 'Forwarded to SM'
        : 'Submitted to ASM';

    const defaultDesignation = isSm
      ? 'Sales Manager'
      : isAsm
        ? 'Area Sales Manager'
        : 'Business Development Executive';

    const stepDescription = isSm
      ? 'Step 1 - SM Request: Submitted to Admin/Accounts'
      : isAsm
        ? 'Step 1 - ASM Request: Submitted to SM'
        : 'Step 1 - BDE Request: Submitted to ASM';

    const targetLabel = isSm ? 'Admin/Accounts' : isAsm ? 'SM' : `ASM ${asmName || asmId}`.trim();

    const newRequest = await SalaryRequest.create({
      request_id: requestId,
      employee_id: employeeId,
      employee_name: employeeName,
      designation: employee?.designation || defaultDesignation,
      team: team || (isSm ? 'Statewide' : ''),
      asm_id: isSm ? '' : isAsm ? employeeId : asmId,
      asm_name: isSm ? '' : isAsm ? employeeName : asmName,
      sm_id: isSm ? employeeId : asmId,
      sm_name: isSm ? employeeName : asmName,
      amount,
      period,
      attendance_days: Number(body.attendance_days ?? 30),
      remarks: body.remarks || 'Monthly minimum salary request',
      status: initialStatus,
      approval_history: [
        {
          step: stepDescription,
          actor: employeeName,
          role: auth.role,
          action: initialStatus,
          remarks: body.remarks || 'Monthly salary request',
          timestamp: new Date(),
        },
      ],
    });

    await logActivity({
      description: `Salary request of ₹${amount} for ${period} submitted by ${employeeName} (${employeeId}) to ${targetLabel}`,
      subjectType: 'Salary Request',
      causer: causerFromRequest(req),
    });

    return NextResponse.json({
      success: true,
      message: `Salary request of ₹${amount} submitted to ${targetLabel} for review.`,
      data: newRequest,
    });
  } catch (error: any) {
    console.error('POST /api/salary/request error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to submit salary request' },
      { status: 500 }
    );
  }
}
