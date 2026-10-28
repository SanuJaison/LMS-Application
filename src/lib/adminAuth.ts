import { NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/jwt';

/**
 * Guard for admin-only API routes.
 *
 * Returns a 401/403 response when the request has no valid admin/manager
 * token, or `null` when the caller is allowed to continue.
 *
 * Usage:
 *   const denied = requireAdmin(req);
 *   if (denied) return denied;
 *
 * Employee tokens (role "employee") are rejected, so the mobile app can never
 * reach admin CRUD endpoints. Mobile endpoints are not wrapped by this guard.
 */
export function requireAdmin(req: Request): NextResponse | null {
  const auth = authenticateAdmin(req);

  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, message: auth.error || 'Unauthorized' },
      { status: auth.status || 401 }
    );
  }

  return null;
}
