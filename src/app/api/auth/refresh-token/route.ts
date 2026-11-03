import { NextResponse } from 'next/server';
import { authenticateToken, unauthorized } from '@/lib/apiAuth';
import {
  extractTokenFromHeader,
  signToken,
  verifyToken,
  TOKEN_EXPIRES_IN,
} from '@/lib/jwt';

/**
 * POST /api/auth/refresh-token
 * Issues a fresh 1-day token for a valid, active identity.
 *
 * The token may be sent as a Bearer header or in the JSON body. The body form
 * is important for mobile clients that refresh their session on app resume.
 * Invalid, expired or inactive identities are rejected with 401.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = extractTokenFromHeader(req) || String(body.token || '').trim();

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'No token provided' },
        { status: 400 }
      );
    }

    // The token must still verify (refresh happens before expiry) and the
    // identity must be active in the database.
    if (!verifyToken(token)) {
      return unauthorized('Invalid or expired token. Please log in again.');
    }

    const auth = await authenticateToken(token);
    if (!auth) {
      return unauthorized('Invalid or expired token. Please log in again.');
    }

    const payload = { ...auth.decoded };
    delete (payload as any).iat;
    delete (payload as any).exp;

    const newToken = signToken(payload, TOKEN_EXPIRES_IN);

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
