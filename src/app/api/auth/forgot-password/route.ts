import { handleForgotPassword } from '@/lib/forgotPassword';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/forgot-password
 * Alias for POST /api/forgot-password.
 */
export async function POST(req: Request) {
  return handleForgotPassword(req);
}

export async function PUT(req: Request) {
  return handleForgotPassword(req);
}

export async function PATCH(req: Request) {
  return handleForgotPassword(req);
}
