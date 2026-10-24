import { NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/jwt';
import { connectDB } from '@/lib/db';
import { User } from '@/models/users';

/**
 * GET /api/auth/me
 * Verify JWT token and get current authenticated admin info
 */
export async function GET(req: Request) {
  try {
    const auth = authenticateAdmin(req);
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { success: false, message: auth.error || 'Unauthorized' },
        { status: auth.status || 401 }
      );
    }

    await connectDB();
    const user = await User.findById(auth.user.id).select('-password').lean();

    return NextResponse.json({
      success: true,
      message: 'Authorization verified',
      user: user
        ? { ...user, id: (user as any)._id.toString() }
        : auth.user,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Authorization check failed' },
      { status: 500 }
    );
  }
}
