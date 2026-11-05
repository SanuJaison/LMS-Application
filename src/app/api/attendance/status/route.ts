import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Attendance } from '@/models/attendence';
import { requireEmployee } from '@/lib/apiAuth';
import { todayKey, formatHoursWorked } from '@/lib/employeeAuth';

/**
 * GET /api/attendance/status
 * Today's attendance for the signed-in employee.
 * Returns the latest check_in and check_out times, current online/offline status,
 * cumulative hours worked, and complete session punch history for today.
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
        ...(employeeId ? [{ employee_id: employeeId, date: today }] : []),
        { name: new RegExp(`^${escapeRegex(employeeName)}$`, 'i'), date: today },
      ],
    }).lean();

    const isCheckedIn = Boolean(
      record &&
      record.check_in &&
      (record.status === 'ONLINE' || !record.check_out)
    );
    const isCheckedOut = Boolean(record && record.check_out && !isCheckedIn);

    const rawSessions = Array.isArray(record?.sessions) ? record.sessions : [];
    const sanitizedSessions = rawSessions.map((s: any) => {
      const formatted = formatHoursWorked(s.hours_worked, s.check_in, s.check_out);
      return {
        ...s,
        check_in: s.check_in || '',
        check_out: s.check_out || '',
        hours_worked: formatted,
        hours_worked_formatted: formatted,
        latitude: typeof s.latitude === 'number' && !isNaN(s.latitude) ? s.latitude : 10.0159,
        longitude: typeof s.longitude === 'number' && !isNaN(s.longitude) ? s.longitude : 76.3419,
        location_lat: typeof s.latitude === 'number' && !isNaN(s.latitude) ? s.latitude : 10.0159,
        location_lng: typeof s.longitude === 'number' && !isNaN(s.longitude) ? s.longitude : 76.3419,
        address: s.address || '',
        notes: s.notes || '',
      };
    });

    const lat = typeof record?.latitude === 'number' && !isNaN(record.latitude) ? record.latitude : 10.0159;
    const lng = typeof record?.longitude === 'number' && !isNaN(record.longitude) ? record.longitude : 76.3419;

    const payload = {
      employee_id: employeeId,
      name: employeeName,
      date: today,
      check_in: record?.check_in || '',
      check_out: isCheckedIn ? '' : (record?.check_out || ''),
      status: isCheckedIn ? 'ONLINE' : isCheckedOut ? 'OFFLINE' : 'NOT_STARTED',
      shift_status: isCheckedIn ? 'ONLINE' : isCheckedOut ? 'COMPLETED' : 'NOT_STARTED',
      is_checked_in: isCheckedIn,
      checked_in: isCheckedIn,
      checked_out: isCheckedOut,
      hours_worked: formatHoursWorked(record?.hours_worked, record?.check_in, record?.check_out),
      hours_worked_formatted: formatHoursWorked(record?.hours_worked, record?.check_in, record?.check_out),
      sessions: sanitizedSessions,
      punches: sanitizedSessions,
      latitude: lat,
      longitude: lng,
      location_lat: lat,
      location_lng: lng,
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
