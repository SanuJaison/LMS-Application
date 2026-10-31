import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Attendance } from '@/models/attendence';
import { requireEmployee } from '@/lib/apiAuth';
import { formatTime, todayKey } from '@/lib/employeeAuth';
import { logActivity, causerFromRequest } from '@/lib/activityLog';

/**
 * POST /api/attendance/check-in
 * Records today's check-in for the signed-in employee.
 *
 * The employee is always taken from the Bearer token. `employee_id` / `name`
 * in the body are ignored, so one employee can no longer check in for another.
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
        { employee_id: employeeId, date: today },
        { name: new RegExp(`^${escapeRegex(employeeName)}$`, 'i'), date: today },
      ],
    });

    if (record) {
      if (record.check_in) {
        return NextResponse.json({
          success: true,
          message: 'Already checked in today.',
          data: {
            date: today,
            check_in: record.check_in,
            status: 'ONLINE',
          },
        });
      }
      record.check_in = checkInTime;
      record.status = 'ONLINE';
      if (latitude) (record as any).latitude = latitude;
      if (longitude) (record as any).longitude = longitude;
      if (address) (record as any).address = address;
      await record.save();
    } else {
      record = await Attendance.create({
        name: employeeName,
        employee_id: employeeId,
        designation: employee?.designation || 'Business Development Executive',
        district: employee?.district || 'Ernakulam',
        date: today,
        check_in: checkInTime,
        status: 'ONLINE',
        hours_worked: 0,
        latitude,
        longitude,
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
        status: 'ONLINE',
        hours_worked: 0,
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

function escapeRegex(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
