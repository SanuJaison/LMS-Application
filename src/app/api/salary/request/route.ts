import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { SalaryRequest } from '@/models/salaryRequest';
import { Employee } from '@/models/employee';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';
import { logActivity, causerFromRequest } from '@/lib/activityLog';

/**
 * POST /api/salary/request
 * Submits a monthly minimum salary request (₹5,000 minimum).
 *
 * Workflow:
 * Step 1: BDE submits salary request to assigned ASM.
 * Status: 'Submitted to ASM'
 */
export async function POST(req: Request) {
  try {
    await connectDB();

    const token = extractTokenFromHeader(req);
    const decoded = token ? verifyToken(token) : null;
    const body = await req.json().catch(() => ({}));

    let employee: any = null;
    if (decoded?.role === 'employee' && decoded.id) {
      employee = await Employee.findById(decoded.id).lean();
    } else if (body.employee_id) {
      employee = await Employee.findOne({ employee_id: body.employee_id }).lean();
    } else if (body.employee) {
      employee = await Employee.findOne({
        name: new RegExp(`^${String(body.employee).trim()}$`, 'i'),
      }).lean();
    }

    const employeeName = employee?.name || body.employee || 'BDE';
    const employeeId = employee?.employee_id || body.employee_id || '';
    const team = employee?.team || body.team || '';
    const asmId = employee?.reports_to || body.asm_id || '';

    let asmName = body.asm_name || '';
    if (!asmName && asmId) {
      const asmEmp: any = await Employee.findOne({ employee_id: asmId }).lean();
      if (asmEmp) asmName = asmEmp.name;
    }

    const amount = Number(body.amount ?? 5000);
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

    // Check if a request already exists for this period
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

    const newRequest = await SalaryRequest.create({
      request_id: requestId,
      employee_id: employeeId,
      employee_name: employeeName,
      designation: employee?.designation || 'Business Development Executive',
      team,
      asm_id: asmId,
      asm_name: asmName,
      amount,
      period,
      attendance_days: Number(body.attendance_days ?? 30),
      remarks: body.remarks || 'Monthly minimum salary request',
      status: 'Submitted to ASM',
      approval_history: [
        {
          step: 'Step 1 - BDE Request',
          actor: employeeName,
          role: 'BDE',
          action: 'Submitted salary request to assigned ASM',
          remarks: body.remarks || 'Monthly salary request',
          timestamp: new Date(),
        },
      ],
    });

    await logActivity({
      description: `Salary request of ₹${amount} for ${period} submitted by ${employeeName} to ASM ${asmName || asmId}`,
      subjectType: 'Salary Request',
      causer: causerFromRequest(req),
    });

    return NextResponse.json({
      success: true,
      message: `Salary request of ₹${amount} submitted to ASM ${asmName} for review.`,
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
