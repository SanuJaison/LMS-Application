import { NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from './jwt';

/**
 * Validates admin authentication.
 *
 * Admin portal requests must send either:
 *   Authorization: Bearer <admin token>   (role admin / superadmin / manager)
 * or
 *   x-admin-key: <ADMIN_KEY>
 *
 * Returns null when authorized, or a 401/403 NextResponse otherwise.
 */
export function requireAdmin(req: Request): NextResponse | null {
  const token = extractTokenFromHeader(req);

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      if (
        decoded.role === 'admin' ||
        decoded.role === 'superadmin' ||
        decoded.role === 'manager'
      ) {
        return null;
      }
      // Valid identity but not an admin role -> 403 Forbidden (NOT 401, so valid session is NOT invalidated)
      return NextResponse.json(
        {
          success: false,
          message: 'Admin authorization required. This action is restricted to administrators.',
        },
        { status: 403 }
      );
    }
  }

  const apiKey = req.headers.get('x-admin-key');
  if (apiKey && apiKey === (process.env.ADMIN_KEY || 'kide-admin-secret')) {
    return null;
  }

  return NextResponse.json(
    {
      success: false,
      message:
        'Admin authentication required. Send Authorization: Bearer <admin token> or x-admin-key.',
    },
    { status: 401 }
  );
}
