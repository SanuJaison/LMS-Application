import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Attendance } from '@/models/attendence';
import { requireEmployee } from '@/lib/apiAuth';
import { formatTime, parseTimeToMinutes, todayKey } from '@/lib/employeeAuth';
import { logActivity, causerFromRequest } from '@/lib/activityLog';

/**
 * POST /api/attendance/check-out
 * Records today's check-out for the signed-in employee.
 *
 * Identity comes from the Bearer token. The Attendance `status` enum only
 * allows ONLINE / OFFLINE, so a completed day is stored as OFFLINE.
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
        { employee_id: employeeId, date: today },
        { name: new RegExp(`^${escapeRegex(employeeName)}$`, 'i'), date: today },
      ],
    });

    let hoursWorked = 8.0;
    if (record && record.check_in) {
      const inMinutes = parseTimeToMinutes(record.check_in);
      const outMinutes = parseTimeToMinutes(checkOutTime);
      if (inMinutes !== null && outMinutes !== null && outMinutes > inMinutes) {
        hoursWorked = parseFloat(((outMinutes - inMinutes) / 60).toFixed(2));
      }
    }

    if (record) {
      record.check_out = checkOutTime;
      record.status = 'OFFLINE';
      record.hours_worked = hoursWorked;
      if (notes) (record as any).notes = notes;
      await record.save();
    } else {
      record = await Attendance.create({
        name: employeeName,
        employee_id: employeeId,
        designation: employee?.designation || 'Business Development Executive',
        district: employee?.district || 'Ernakulam',
        date: today,
        check_in: '09:00 AM',
        check_out: checkOutTime,
        status: 'OFFLINE',
        hours_worked: hoursWorked,
      });
    }

    await logActivity({
      description: `Attendance Check-Out logged for ${employeeName} at ${checkOutTime} (${hoursWorked} hrs worked)`,
      subjectType: 'Attendance',
      causer: causerFromRequest(req),
    });

    return NextResponse.json({
      success: true,
      message: `Checked out successfully at ${checkOutTime}.`,
      data: {
        date: today,
        check_in: record.check_in,
        check_out: checkOutTime,
        hours_worked: hoursWorked,
        status: 'OFFLINE',
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

function escapeRegex(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
