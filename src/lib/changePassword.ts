import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Employee } from '@/models/employee';
import { requireEmployee } from '@/lib/apiAuth';
import { checkPassword, hashPassword } from '@/lib/password';

/**
 * Shared handler for POST /api/employee/change-password
 *
 * Body:
 *   { "current_password": "old", "new_password": "new" }
 * Aliases: old_password / currentPassword / password / newPassword
 *
 * Auth: Authorization: Bearer <employee token>. The account is always taken
 * from the token; `employee_id` in the body can no longer target another user.
 */
export async function handleChangePassword(req: Request) {
  try {
    await connectDB();

    const guard = await requireEmployee(req);
    if (!guard.ok) return guard.response;

    const body = await req.json().catch(() => ({}));

    const currentPassword = String(
      body.current_password ?? body.old_password ?? body.currentPassword ?? ''
    );
    const newPassword = String(body.new_password ?? body.password ?? body.newPassword ?? '');

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

    // Always resolve the account from the token.
    const employee: any = await Employee.findById(guard.auth.employee._id).select('+password');

    if (!employee) {
      return NextResponse.json(
        { success: false, message: 'Unable to identify the employee.' },
        { status: 401 }
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
