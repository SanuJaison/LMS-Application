import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/apiAuth';
import { hierarchyRole } from '@/lib/hierarchy';
import { serializeEmployee } from '@/lib/employeeAuth';
import { handleDeleteAccount } from '@/lib/deleteAccount';

export async function DELETE(req: Request) {
  return handleDeleteAccount(req);
}

/**
 * GET /api/auth/me
 *
 * Returns the signed-in identity for both portals:
 *   - admin portal token  -> role "admin"
 *   - employee/app token  -> the employee profile
 *
 * The old implementation delegated to /api/profile, which rejects admin
 * tokens, so the admin portal could never verify its own session.
 */
export async function GET(req: Request) {
  try {
    const auth = await authenticate(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: 'Authentication required. Send a valid Bearer token.' },
        { status: 401 }
      );
    }

    if (auth.isAdmin) {
      const user = {
        id: auth.decoded.id || '',
        name: auth.name,
        email: auth.decoded.email || '',
        role: 'admin',
        designation: 'Administrator',
        designation_name: 'Administrator',
        team: '',
        zone: '',
        district: '',
        reports_to: null,
        status: 'active',
        require_password_change: false,
      };

      return NextResponse.json({
        success: true,
        message: 'Session loaded',
        user,
        data: user,
      });
    }

    const employee: any = auth.employee;
    const role = hierarchyRole(employee);
    const user = {
      id: employee._id.toString(),
      employee_id: employee.employee_id || '',
      name: employee.name || 'User',
      email: employee.email || '',
      role,
      designation: employee.designation || role,
      designation_name: employee.designation || role,
      team: employee.team || '',
      zone: employee.zone || '',
      district: employee.district || '',
      reports_to: employee.reports_to || null,
      status: employee.status || 'active',
      require_password_change: false,
    };

    return NextResponse.json({
      success: true,
      message: 'Session loaded',
      user,
      data: {
        ...user,
        contact_number: employee.contact_number || '',
        phone: employee.contact_number || '',
        leave_balances: { casual: 12, medical: 8, earned: 15 },
        ...serializeEmployee(employee),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to load session' },
      { status: 500 }
    );
  }
}
