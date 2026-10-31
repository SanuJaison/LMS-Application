import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Attendance } from '@/models/attendence';
import { Employee } from '@/models/employee';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';
import { todayKey } from '@/lib/employeeAuth';

/**
 * GET /api/attendance/status
 * Returns today's attendance status for the calling employee.
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const token = extractTokenFromHeader(req);
    const decoded = token ? verifyToken(token) : null;

    let employee: any = null;
    if (decoded?.role === 'employee' && decoded.id) {
      employee = await Employee.findById(decoded.id).lean();
    }

    if (!employee) {
      const { searchParams } = new URL(req.url);
      const email = searchParams.get('email');
      const empId = searchParams.get('employee_id');

      if (email || empId) {
        employee = await Employee.findOne({
          $or: [
            ...(email ? [{ email: email.toLowerCase() }] : []),
            ...(empId ? [{ employee_id: empId }] : []),
          ],
        }).lean();
      } else {
        employee = await Employee.findOne({ status: 'active' }).lean();
      }
    }

    const employeeName = employee?.name || 'Employee';
    const employeeId = employee?.employee_id || '';
    const today = todayKey();

    const record: any = await Attendance.findOne({
      $or: [
        { employee_id: employeeId, date: today },
        { name: new RegExp(`^${employeeName.trim()}$`, 'i'), date: today },
      ],
    }).lean();

    const isCheckedIn = Boolean(record && record.check_in && !record.check_out);
    const isCheckedOut = Boolean(record && record.check_out);

    const payload = {
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
