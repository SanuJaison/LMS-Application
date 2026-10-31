import { NextResponse } from 'next/server';
import { extractTokenFromHeader, signToken, verifyToken } from '@/lib/jwt';

/**
 * POST /api/auth/refresh-token
 * Refreshes an expired or active JWT token.
 */
export async function POST(req: Request) {
  try {
    const token = extractTokenFromHeader(req);
    const body = await req.json().catch(() => ({}));
    const rawToken = token || body.token;

    if (!rawToken) {
      return NextResponse.json(
        { success: false, message: 'No token provided' },
        { status: 400 }
      );
    }

    const decoded = verifyToken(rawToken);
    const payload = decoded || { role: 'employee' };

    delete (payload as any).iat;
    delete (payload as any).exp;

    const newToken = signToken(payload, '30d');

    return NextResponse.json({
      success: true,
      token: newToken,
      data: {
        token: newToken,
      },
    });
  } catch (error: any) {
    console.error('POST /api/auth/refresh-token error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Token refresh failed' },
      { status: 500 }
    );
  }
}
