import { ok } from '@/lib/employeeAuth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/logout
 *
 * JWTs are stateless, so there is nothing to invalidate server-side.
 * The app just discards the token. Kept so the mobile client's logout
 * call succeeds instead of hitting a 404.
 */
export async function POST() {
  return ok(null, 'Logged out successfully');
}
