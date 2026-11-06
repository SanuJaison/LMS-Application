import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Employee } from '@/models/employee';
import { User } from '@/models/users';
import { requireAdmin } from '@/lib/adminAuth';
import bcrypt from 'bcryptjs';

/**
 * POST /api/set-password
 * Set / reset an employee or admin password.
 *
 * Admin only. Previously this was unauthenticated, which let anyone overwrite
 * any account's password.
 */
export async function POST(req: Request) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;

    await connectDB();
    const body = await req.json().catch(() => ({}));
    const { employee_id, email, password } = body;

    if (!password || !String(password).trim()) {
      return NextResponse.json(
        { success: false, message: 'Password is required' },
        { status: 400 }
      );
    }

    if (!employee_id && !email) {
      return NextResponse.json(
        { success: false, message: 'employee_id or email is required' },
        { status: 400 }
      );
    }

    const plainPassword = String(password).trim();

    const emp = await Employee.findOneAndUpdate(
      {
        $or: [
          ...(employee_id ? [{ employee_id }] : []),
          ...(email ? [{ email: String(email).toLowerCase() }] : []),
        ],
      },
      { password: plainPassword },
      { new: true }
    );

    let userUpdated = null;
    if (email) {
      userUpdated = await User.findOneAndUpdate(
        { email: String(email).toLowerCase() },
        { password: plainPassword }
      );
    }

    if (!emp && !userUpdated) {
      return NextResponse.json(
        { success: false, message: 'Account not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error: any) {
    console.error('POST /api/set-password error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update password' },
      { status: 500 }
    );
  }
}
