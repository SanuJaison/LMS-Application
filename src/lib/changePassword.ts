import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Employee } from '@/models/employee';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';
import { checkPassword, hashPassword } from '@/lib/password';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Shared handler for POST /api/set-password and /api/employee/change-password
 *
 * Body:
 *   { "current_password": "old", "new_password": "new" }
 * Aliases: old_password / currentPassword / password / newPassword
 *
 * Auth: Authorization: Bearer <token>, or "employee_id" in the body.
 */
export async function handleChangePassword(req: Request) {
  try {
    await connectDB();

    const body = await req.json().catch(() => ({}));

    const currentPassword = String(
      body.current_password ?? body.old_password ?? body.currentPassword ?? ''
    );
    const newPassword = String(body.new_password ?? body.password ?? body.newPassword ?? '');
    const employeeIdInput = String(
      body.employee_id ?? body.emp_id ?? body.employeeId ?? ''
    ).trim();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, message: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, message: 'New password must be at least 6 characters' },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { success: false, message: 'New password must be different from the current password' },
        { status: 400 }
      );
    }

    // Resolve the employee: JWT first, then employee_id from the body
    let employee: any = null;

    const token = extractTokenFromHeader(req);
    const decoded = token ? verifyToken(token) : null;
    if (decoded?.id) {
      employee = await Employee.findById(decoded.id).select('+password');
    }

    if (!employee && employeeIdInput) {
      employee = await Employee.findOne({
        employee_id: { $regex: `^${escapeRegex(employeeIdInput)}$`, $options: 'i' },
      }).select('+password');
    }

    if (!employee) {
      return NextResponse.json(
        {
          success: false,
          message: 'Unable to identify the employee. Provide a valid token or employee_id.',
        },
        { status: 401 }
      );
    }

    if (String(employee.status || '').toLowerCase() === 'inactive') {
      return NextResponse.json(
        {
          success: false,
          message: 'This employee account is inactive. Please contact your admin.',
        },
        { status: 403 }
      );
    }

    const isMatch = await checkPassword(currentPassword, employee);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, message: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    employee.password = await hashPassword(newPassword);
    employee.require_password_change = false;
    await employee.save();

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully',
      data: { require_password_change: false },
    });
  } catch (error: any) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to change password' },
      { status: 500 }
    );
  }
}
