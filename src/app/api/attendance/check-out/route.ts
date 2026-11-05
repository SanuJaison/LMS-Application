import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Attendance } from '@/models/attendence';
import { requireEmployee } from '@/lib/apiAuth';
import { formatTime, parseTimeToMinutes, todayKey, formatHoursWorked } from '@/lib/employeeAuth';
import { logActivity, causerFromRequest } from '@/lib/activityLog';

/**
 * POST /api/attendance/check-out
 * Records check-out for the signed-in employee.
 * Supports multiple check-ins and check-outs in a single day.
 * Reflects the latest check_out time, calculates cumulative hours worked across all sessions,
 * and records session details into attendance history.
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

    let notes = '';

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      notes = String(formData.get('notes') || '');
    } else {
      const body = await req.json().catch(() => ({}));
      notes = body.notes || '';
    }

    const today = todayKey();
    const checkOutTime = formatTime(new Date());

    let record = await Attendance.findOne({
      $or: [
        ...(employeeId ? [{ employee_id: employeeId, date: today }] : []),
        { name: new RegExp(`^${escapeRegex(employeeName)}$`, 'i'), date: today },
      ],
    });

    let currentSessionHours = 0;
    if (record && record.check_in) {
      const inMinutes = parseTimeToMinutes(record.check_in);
      const outMinutes = parseTimeToMinutes(checkOutTime);
      if (inMinutes !== null && outMinutes !== null && outMinutes > inMinutes) {
        currentSessionHours = parseFloat(((outMinutes - inMinutes) / 60).toFixed(2));
      }
    }

    if (record) {
      record.check_out = checkOutTime;
      record.status = 'OFFLINE';
      if (notes) (record as any).notes = notes;

      if (!record.sessions) record.sessions = [];

      // Find the last open session (one without a check_out)
      const lastSession = record.sessions.length > 0 ? record.sessions[record.sessions.length - 1] : null;
      if (lastSession && !lastSession.check_out) {
        lastSession.check_out = checkOutTime;
        lastSession.hours_worked = currentSessionHours;
        if (notes) lastSession.notes = notes;
      } else {
        record.sessions.push({
          check_in: record.check_in || '',
          check_out: checkOutTime,
          hours_worked: currentSessionHours,
          notes,
          created_at: new Date(),
        });
      }

      // Calculate total cumulative hours worked today across all sessions
      const totalHours = record.sessions.reduce(
        (sum: number, s: any) => sum + (Number(s.hours_worked) || 0),
        0
      );
      record.hours_worked = formatHoursWorked(totalHours);

      await record.save();
    } else {
      record = await Attendance.create({
        name: employeeName,
        employee_id: employeeId,
        designation: employee?.designation || 'Business Development Executive',
        district: employee?.district || 'Ernakulam',
        date: today,
        check_in: '',
        check_out: checkOutTime,
        status: 'OFFLINE',
        hours_worked: 0,
        notes,
        sessions: [
          {
            check_in: '',
            check_out: checkOutTime,
            hours_worked: 0,
            notes,
            created_at: new Date(),
          },
        ],
      });
    }

    await logActivity({
      description: `Attendance Check-Out logged for ${employeeName} at ${checkOutTime} (${record.hours_worked} hrs worked)`,
      subjectType: 'Attendance',
      causer: causerFromRequest(req),
    });

    return NextResponse.json({
      success: true,
      message: `Checked out successfully at ${checkOutTime}.`,
      data: {
        date: today,
        check_in: record.check_in || '',
        check_out: checkOutTime,
        hours_worked: formatHoursWorked(record.hours_worked, record.check_in, checkOutTime),
        hours_worked_formatted: formatHoursWorked(record.hours_worked, record.check_in, checkOutTime),
        status: 'OFFLINE',
        is_checked_in: false,
        sessions: sanitizeSessions(record.sessions),
      },
    });
  } catch (error: any) {
    console.error('POST /api/attendance/check-out error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Check-out failed' },
      { status: 500 }
    );
  }
}

function sanitizeSessions(sessions: any[]): any[] {
  if (!Array.isArray(sessions)) return [];
  return sessions.map((s: any) => {
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
}

function escapeRegex(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
