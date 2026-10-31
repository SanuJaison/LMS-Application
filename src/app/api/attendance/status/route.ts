import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Attendance } from '@/models/attendence';
import { requireEmployee } from '@/lib/apiAuth';
import { todayKey } from '@/lib/employeeAuth';

/**
 * GET /api/attendance/status
 * Today's attendance for the signed-in employee only.
 * Requires an employee Bearer token; query params can no longer impersonate.
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireEmployee(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const employeeName = auth.name;
    const employeeId = auth.employeeId;
    const today = todayKey();

    const record: any = await Attendance.findOne({
      $or: [
        { employee_id: employeeId, date: today },
        { name: new RegExp(`^${escapeRegex(employeeName)}$`, 'i'), date: today },
      ],
    }).lean();

    const isCheckedIn = Boolean(record && record.check_in && !record.check_out);
    const isCheckedOut = Boolean(record && record.check_out);

    const payload = {
      employee_id: employeeId,
      name: employeeName,
      date: today,
      check_in: record?.check_in || null,
      check_out: record?.check_out || null,
      status: isCheckedIn ? 'ONLINE' : isCheckedOut ? 'OFFLINE' : 'NOT_STARTED',
      shift_status: isCheckedIn ? 'ONLINE' : isCheckedOut ? 'COMPLETED' : 'NOT_STARTED',
      is_checked_in: isCheckedIn,
      checked_in: isCheckedIn,
      checked_out: isCheckedOut,
      hours_worked: record?.hours_worked ?? 0,
      latitude: record?.latitude ?? null,
      longitude: record?.longitude ?? null,
    };

    return NextResponse.json({
      success: true,
      message: 'Attendance status loaded',
      data: payload,
    });
  } catch (error: any) {
    console.error('GET /api/attendance/status error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch attendance status' },
      { status: 500 }
    );
  }
}

function escapeRegex(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
