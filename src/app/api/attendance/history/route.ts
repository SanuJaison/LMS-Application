import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Attendance } from '@/models/attendence';
import { Employee } from '@/models/employee';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';

/**
 * GET /api/attendance/history
 * Returns the attendance history records for an employee.
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

    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const empId = searchParams.get('employee_id');

    if (!employee && (email || empId)) {
      employee = await Employee.findOne({
        $or: [
          ...(email ? [{ email: email.toLowerCase() }] : []),
          ...(empId ? [{ employee_id: empId }] : []),
        ],
      }).lean();
    }

    const query: Record<string, any> = {};
    if (employee) {
      query.$or = [
        { employee_id: employee.employee_id },
        { name: new RegExp(`^${employee.name.trim()}$`, 'i') },
      ];
    }

    const month = searchParams.get('month'); // e.g. "2026-10"
    if (month) {
      query.date = new RegExp(`^${month}`);
    }

    const records = await Attendance.find(query)
      .sort({ date: -1 })
      .limit(31)
      .lean();

    const data = records.map((r: any) => ({
      date: r.date,
      check_in: r.check_in || '--:--',
      check_out: r.check_out || '--:--',
      hours_worked: r.hours_worked ?? 8,
      status: r.status === 'COMPLETED' ? 'PRESENT' : r.status || 'PRESENT',
    }));

    return NextResponse.json({
      success: true,
      message: 'Attendance history loaded',
      data,
    });
  } catch (error: any) {
    console.error('GET /api/attendance/history error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch attendance history' },
      { status: 500 }
    );
  }
}
