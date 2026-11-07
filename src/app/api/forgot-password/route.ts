import { handleForgotPassword } from '@/lib/forgotPassword';

export const dynamic = 'force-dynamic';

/**
 * POST /api/forgot-password
 * Allows SM, ASM, and BDE employees to reset their password using
 * employee_id, new_password, and confirm_password.
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
