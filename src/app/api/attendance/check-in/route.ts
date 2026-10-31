import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Attendance } from '@/models/attendence';
import { Employee } from '@/models/employee';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';
import { formatTime, todayKey } from '@/lib/employeeAuth';
import { logActivity, causerFromRequest } from '@/lib/activityLog';

/**
 * POST /api/attendance/check-in
 * Records daily employee check-in with timestamp and optional coordinates.
 */
export async function POST(req: Request) {
  try {
    await connectDB();

    const token = extractTokenFromHeader(req);
    const decoded = token ? verifyToken(token) : null;

    let employee: any = null;
    if (decoded?.role === 'employee' && decoded.id) {
      employee = await Employee.findById(decoded.id).lean();
    }

    // Support FormData or JSON body
    let latitude: number | null = null;
    let longitude: number | null = null;
    let address = '';
    let employeeId = employee?.employee_id || '';
    let employeeName = employee?.name || '';

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      latitude = parseFloat(String(formData.get('latitude') || '0')) || null;
      longitude = parseFloat(String(formData.get('longitude') || '0')) || null;
      address = String(formData.get('address') || '');
      if (!employeeId) employeeId = String(formData.get('employee_id') || '');
      if (!employeeName) employeeName = String(formData.get('name') || '');
    } else {
      const body = await req.json().catch(() => ({}));
      latitude = body.latitude ?? null;
      longitude = body.longitude ?? null;
      address = body.address || '';
      if (!employeeId) employeeId = body.employee_id || '';
      if (!employeeName) employeeName = body.name || '';
    }

    if (!employee && employeeId) {
      employee = await Employee.findOne({ employee_id: employeeId }).lean();
      if (employee) employeeName = employee.name;
    }

    if (!employeeName) {
      employeeName = 'Employee';
    }

    const today = todayKey();
    const checkInTime = formatTime(new Date());

    let record = await Attendance.findOne({
      $or: [
        { employee_id: employeeId, date: today },
        { name: new RegExp(`^${employeeName.trim()}$`, 'i'), date: today },
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
