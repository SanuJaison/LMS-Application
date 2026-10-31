import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Employee } from '@/models/employee';
import { User } from '@/models/users';
import bcrypt from 'bcryptjs';

/**
 * POST /api/set-password
 * Set / reset password for employee.
 */
export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json().catch(() => ({}));
    const { employee_id, email, password } = body;

    if (!password || !password.trim()) {
      return NextResponse.json(
        { success: false, message: 'Password is required' },
        { status: 400 }
      );
    }

    const hashedPassword = bcrypt.hashSync(password.trim(), 10);

    const emp = await Employee.findOneAndUpdate(
      {
        $or: [
          ...(employee_id ? [{ employee_id }] : []),
          ...(email ? [{ email: email.toLowerCase() }] : []),
        ],
      },
      { password: hashedPassword },
      { new: true }
    );

    if (email) {
      await User.findOneAndUpdate(
        { email: email.toLowerCase() },
        { password: hashedPassword }
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
