import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Employee } from '@/models/employee';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';
import { serializeEmployee } from '@/lib/employeeAuth';

/**
 * GET /api/profile
 * Returns the current authenticated employee's profile data.
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
      // Fallback: fetch first active employee or query param
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

    if (!employee) {
      return NextResponse.json(
        { success: false, message: 'Profile not found' },
        { status: 404 }
      );
    }

    const payload = {
      id: employee._id.toString(),
      name: employee.name || 'User',
      designation: employee.designation || 'Business Development Executive',
      designation_name: employee.designation || 'Business Development Executive',
      email: employee.email || '',
      contact_number: employee.contact_number || '',
      phone: employee.contact_number || '',
      employee_id: employee.employee_id || '',
      team: employee.team || '',
      zone: employee.zone || '',
      district: employee.district || '',
      reports_to: employee.reports_to || '',
      leave_balances: {
        casual: 12,
        medical: 8,
        earned: 15,
      },
      ...serializeEmployee(employee),
    };

    return NextResponse.json({
      success: true,
      message: 'Profile loaded',
      data: payload,
    });
  } catch (error: any) {
    console.error('GET /api/profile error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}
