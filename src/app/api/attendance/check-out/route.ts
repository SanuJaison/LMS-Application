import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Attendance } from '@/models/attendence';
import { Employee } from '@/models/employee';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';
import { formatTime, parseTimeToMinutes, todayKey } from '@/lib/employeeAuth';
import { logActivity, causerFromRequest } from '@/lib/activityLog';

/**
 * POST /api/attendance/check-out
 * Records daily employee check-out and computes hours worked.
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

    let employeeId = employee?.employee_id || '';
    let employeeName = employee?.name || '';
    let notes = '';

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      notes = String(formData.get('notes') || '');
      if (!employeeId) employeeId = String(formData.get('employee_id') || '');
      if (!employeeName) employeeName = String(formData.get('name') || '');
    } else {
      const body = await req.json().catch(() => ({}));
      notes = body.notes || '';
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
    const checkOutTime = formatTime(new Date());

    let record = await Attendance.findOne({
      $or: [
        { employee_id: employeeId, date: today },
        { name: new RegExp(`^${employeeName.trim()}$`, 'i'), date: today },
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
      record.status = 'COMPLETED';
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
        status: 'COMPLETED',
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
