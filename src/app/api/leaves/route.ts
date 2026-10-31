import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Leave } from '@/models';
import { Employee } from '@/models/employee';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';
import { numericId } from '@/lib/employeeAuth';

/**
 * GET /api/leaves
 * Lists leave applications for the current employee.
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
    const employeeParam = searchParams.get('employee');

    const query: Record<string, any> = {};
    if (employee) {
      query.employee = new RegExp(`^${employee.name.trim()}$`, 'i');
    } else if (employeeParam) {
      query.employee = new RegExp(`^${employeeParam.trim()}$`, 'i');
    }

    const leaves = await Leave.find(query).sort({ createdAt: -1 }).lean();

    const data = leaves.map((l: any) => ({
      id: numericId(l._id) || 1,
      _id: l._id.toString(),
      employee: l.employee,
      leave_type: l.leave_type || 'Casual Leave',
      start_date: l.start_date,
      end_date: l.end_date,
      reason: l.reason || '',
      status: l.status || 'Pending',
    }));

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('GET /api/leaves error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch leaves' },
      { status: 500 }
    );
  }
}
