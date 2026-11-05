import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Attendance } from '@/models/attendence';
import { requireEmployee } from '@/lib/apiAuth';
import { formatTime, todayKey, formatHoursWorked } from '@/lib/employeeAuth';
import { logActivity, causerFromRequest } from '@/lib/activityLog';

/**
 * POST /api/attendance/check-in
 * Records today's check-in for the signed-in employee.
 * Supports multiple check-ins in a single day.
 * When checking in again after checking out, the latest check-in time is recorded,
 * check_out is cleared, status becomes ONLINE, and a new session is appended.
 */
export async function POST(req: Request) {
  try {
    await connectDB();

    const guard = await requireEmployee(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const employee = auth.employee;
    const employeeId = auth.employeeId;
    const employeeName = auth.name;

    let latitude: number | null = null;
    let longitude: number | null = null;
    let address = '';

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      latitude = parseFloat(String(formData.get('latitude') || '0')) || null;
      longitude = parseFloat(String(formData.get('longitude') || '0')) || null;
      address = String(formData.get('address') || '');
    } else {
      const body = await req.json().catch(() => ({}));
      latitude = body.latitude ?? null;
      longitude = body.longitude ?? null;
      address = body.address || '';
    }

    const today = todayKey();
    const checkInTime = formatTime(new Date());

    let record = await Attendance.findOne({
      $or: [
        ...(employeeId ? [{ employee_id: employeeId, date: today }] : []),
        { name: new RegExp(`^${escapeRegex(employeeName)}$`, 'i'), date: today },
      ],
    });

    if (record) {
      const isAlreadyOnline = record.status === 'ONLINE' && record.check_in && !record.check_out;

      if (isAlreadyOnline) {
        if (latitude) (record as any).latitude = latitude;
        if (longitude) (record as any).longitude = longitude;
        if (address) (record as any).address = address;
        await record.save();

        return NextResponse.json({
          success: true,
          message: `Already checked in at ${record.check_in}. Status is ONLINE.`,
          data: {
            date: today,
            check_in: record.check_in,
            check_out: '',
            status: 'ONLINE',
            is_checked_in: true,
            hours_worked: formatHoursWorked(record.hours_worked, record.check_in, record.check_out),
        hours_worked_formatted: formatHoursWorked(record.hours_worked, record.check_in, record.check_out),
            sessions: sanitizeSessions(record.sessions),
          },
        });
      }

      // Re-checking in for an additional shift/session today!
      record.check_in = checkInTime;
      record.check_out = '';
      record.status = 'ONLINE';
      if (latitude) (record as any).latitude = latitude;
      if (longitude) (record as any).longitude = longitude;
      if (address) (record as any).address = address;

      if (!record.sessions) record.sessions = [];
      record.sessions.push({
        check_in: checkInTime,
        check_out: '',
        hours_worked: '0 hours',
        latitude: latitude ?? 10.0159,
        longitude: longitude ?? 76.3419,
        address,
        created_at: new Date(),
      });

      await record.save();
    } else {
      record = await Attendance.create({
        name: employeeName,
        employee_id: employeeId,
        designation: employee?.designation || 'Business Development Executive',
        district: employee?.district || 'Ernakulam',
        date: today,
        check_in: checkInTime,
        check_out: '',
        status: 'ONLINE',
        hours_worked: '0 hours',
        latitude: latitude ?? 10.0159,
        longitude: longitude ?? 76.3419,
        address,
        sessions: [
          {
            check_in: checkInTime,
            check_out: '',
            hours_worked: '0 hours',
            latitude: latitude ?? 10.0159,
            longitude: longitude ?? 76.3419,
            address,
            created_at: new Date(),
          },
        ],
      });
    }

    await logActivity({
      description: `Attendance Check-In logged for ${employeeName} at ${checkInTime}`,
      subjectType: 'Attendance',
      causer: causerFromRequest(req),
    });

    return NextResponse.json({
      success: true,
      message: `Checked in successfully at ${checkInTime}.`,
      data: {
        date: today,
        check_in: checkInTime,
        check_out: '',
        status: 'ONLINE',
        is_checked_in: true,
        hours_worked: formatHoursWorked(record.hours_worked, record.check_in, record.check_out),
        hours_worked_formatted: formatHoursWorked(record.hours_worked, record.check_in, record.check_out),
        sessions: sanitizeSessions(record.sessions),
      },
    });
  } catch (error: any) {
    console.error('POST /api/attendance/check-in error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Check-in failed' },
      { status: 500 }
    );
  }
}

function sanitizeSessions(sessions?: any[]): any[] {
  if (!Array.isArray(sessions)) return [];
  return sessions.map((s: any) => {
    const raw = typeof s?.toObject === 'function' ? s.toObject() : (s?._doc || s || {});
    const formatted = formatHoursWorked(raw.hours_worked, raw.check_in, raw.check_out);
    return {
      _id: raw._id ? String(raw._id) : undefined,
      check_in: raw.check_in || '',
      check_out: raw.check_out || '',
      hours_worked: formatted,
      hours_worked_formatted: formatted,
      latitude: typeof raw.latitude === 'number' && !isNaN(raw.latitude) ? raw.latitude : 10.0159,
      longitude: typeof raw.longitude === 'number' && !isNaN(raw.longitude) ? raw.longitude : 76.3419,
      location_lat: typeof raw.latitude === 'number' && !isNaN(raw.latitude) ? raw.latitude : 10.0159,
      location_lng: typeof raw.longitude === 'number' && !isNaN(raw.longitude) ? raw.longitude : 76.3419,
      address: raw.address || '',
      notes: raw.notes || '',
      created_at: raw.created_at,
    };
  });
}

function escapeRegex(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
