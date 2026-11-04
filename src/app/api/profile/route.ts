import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { serializeEmployee } from '@/lib/employeeAuth';
import { requireEmployee } from '@/lib/apiAuth';
import { hierarchyRole } from '@/lib/hierarchy';

/**
 * GET /api/profile
 * Returns the signed-in employee's profile data.
 *
 * Identity always comes from the Bearer token. The old first-active-employee
 * fallback (and the ?email= / ?employee_id= override) has been removed.
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireEmployee(req);
    if (!guard.ok) return guard.response;

    const employee: any = guard.auth.employee;
    if (!employee) {
      return NextResponse.json(
        { success: false, message: 'Profile not found' },
        { status: 404 }
      );
    }

    const payload = {
      id: employee._id.toString(),
      name: employee.name || 'User',
      role: guard.auth.role || hierarchyRole(employee),
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
      salary: employee.salary ?? 0,
      incentive: employee.incentive ?? 0,
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
