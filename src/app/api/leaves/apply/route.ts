import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Leave } from '@/models';
import { numericId } from '@/lib/employeeAuth';
import { requireEmployee } from '@/lib/apiAuth';
import { logActivity, causerFromRequest } from '@/lib/activityLog';

/**
 * POST /api/leaves/apply
 * Applies for leave as the signed-in employee. The employee name always comes
 * from the token; `employee` / `name` in the body are ignored.
 */
export async function POST(req: Request) {
  try {
    await connectDB();

    const guard = await requireEmployee(req);
    if (!guard.ok) return guard.response;

    const body = await req.json().catch(() => ({}));
    const employeeName = guard.auth.name;

    const leave = await Leave.create({
      employee: employeeName,
      leave_type: body.leave_type || 'Casual Leave',
      start_date: body.start_date || new Date().toISOString().split('T')[0],
      end_date: body.end_date || body.start_date || new Date().toISOString().split('T')[0],
      reason: body.reason || '',
      status: 'Pending',
    });

    await logActivity({
      description: `Leave application submitted by ${employeeName} (${leave.start_date} to ${leave.end_date})`,
      subjectType: 'Leave',
      causer: causerFromRequest(req),
    });

    return NextResponse.json({
      success: true,
      message: 'Leave applied successfully',
      data: {
        id: numericId(leave._id) || 1,
        _id: leave._id.toString(),
        leave_type: leave.leave_type,
        start_date: leave.start_date,
        end_date: leave.end_date,
        status: leave.status,
      },
    });
  } catch (error: any) {
    console.error('POST /api/leaves/apply error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to apply leave' },
      { status: 500 }
    );
  }
}
