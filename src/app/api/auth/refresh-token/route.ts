import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Employee } from '@/models/employee';
import { extractTokenFromHeader, signToken, verifyToken } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/refresh-token
 * Issues a fresh 7-day JWT for a still-valid token.
 */
export async function POST(req: Request) {
  try {
    await connectDB();

    const token = extractTokenFromHeader(req);
    const decoded = token ? verifyToken(token) : null;

    if (!decoded?.id) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired token. Please log in again.' },
        { status: 401 }
      );
    }

    const employee: any = await Employee.findById(decoded.id);

    if (!employee) {
      return NextResponse.json(
        { success: false, message: 'Employee no longer exists. Please log in again.' },
        { status: 401 }
      );
    }

    if (String(employee.status || '').toLowerCase() === 'inactive') {
      return NextResponse.json(
        { success: false, message: 'This employee account is inactive.' },
        { status: 403 }
      );
    }

    const newToken = signToken({
      id: employee._id.toString(),
      name: employee.name,
      email: employee.email || '',
      role: 'employee',
    });

    return NextResponse.json({
      success: true,
      message: 'Token refreshed successfully',
      data: { token: newToken, require_password_change: false },
    });
  } catch (error: any) {
    console.error('POST /api/auth/refresh-token error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to refresh token' },
      { status: 500 }
    );
  }
}
