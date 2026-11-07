import { handleDeleteAccount } from '@/lib/deleteAccount';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/auth/delete-account
 * POST   /api/auth/delete-account
 * Alias for /api/delete-account.
 */
export async function DELETE(req: Request) {
  return handleDeleteAccount(req);
}

export async function POST(req: Request) {
  return handleDeleteAccount(req);
}
