import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Employee } from '@/models/employee';
import { hierarchyRole } from '@/lib/hierarchy';
import { escapeRegex } from '@/lib/employeeAuth';
import { logActivity } from '@/lib/activityLog';

/**
 * Shared handler for Forgot Password (SM, ASM, BDE, Telecaller).
 *
 * Body:
 *   {
 *     "employee_id": "ASM001",
 *     "new_password": "newPassword123",
 *     "confirm_password": "newPassword123"
 *   }
 *
 * No authentication token required (used from the login screen).
 */
export async function handleForgotPassword(req: Request) {
  try {
    await connectDB();

    const body = await req.json().catch(() => ({}));

    const rawIdentifier = String(
      body.employee_id ??
        body.employeeId ??
        body.email ??
        body.identifier ??
        body.id ??
        ''
    ).trim();

    const newPassword = String(
      body.new_password ?? body.newPassword ?? body.password ?? ''
    ).trim();

    const confirmPassword = String(
      body.confirm_password ??
        body.confirmPassword ??
        body.password_confirmation ??
        body.confirm_new_password ??
        ''
    ).trim();

    if (!rawIdentifier) {
      return NextResponse.json(
        {
          success: false,
          message: 'Employee ID is required',
        },
        { status: 400 }
      );
    }

    if (!newPassword) {
      return NextResponse.json(
        {
          success: false,
          message: 'New password is required',
        },
        { status: 400 }
      );
    }

    if (!confirmPassword) {
      return NextResponse.json(
        {
          success: false,
          message: 'Confirm password is required',
        },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        {
          success: false,
          message: 'New password and confirm password do not match',
        },
        { status: 400 }
      );
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        {
          success: false,
          message: 'New password must be at least 4 characters long',
        },
        { status: 400 }
      );
    }

    const employee: any = await Employee.findOne({
      $or: [
        { employee_id: new RegExp(`^${escapeRegex(rawIdentifier)}$`, 'i') },
        { email: rawIdentifier.toLowerCase() },
      ],
    });

    if (!employee) {
      return NextResponse.json(
        {
          success: false,
          message: `Employee "${rawIdentifier}" not found. Please check your Employee ID.`,
        },
        { status: 404 }
      );
    }

    if (String(employee.status || '').toLowerCase() === 'inactive') {
      return NextResponse.json(
        {
          success: false,
          message: `Employee account "${employee.employee_id}" is inactive. Please contact Admin.`,
        },
        { status: 403 }
      );
    }

    employee.password = newPassword;
    employee.require_password_change = false;
    await employee.save();

    const role = hierarchyRole(employee);

    await logActivity({
      description: `${role} ${employee.name} (${employee.employee_id}) reset password via Forgot Password`,
      subjectType: 'Employee',
      causer: `${employee.name} (${employee.employee_id})`,
    });

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
      data: {
        employee_id: employee.employee_id,
        name: employee.name,
        email: employee.email || '',
        role,
        designation: employee.designation || role,
      },
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to reset password',
      },
      { status: 500 }
    );
  }
}
