import { handleDeleteAccount } from '@/lib/deleteAccount';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/employee/delete-account
 * POST   /api/employee/delete-account
 * Alias for /api/delete-account.
 */
export async function DELETE(req: Request) {
  return handleDeleteAccount(req);
}

export async function POST(req: Request) {
  return handleDeleteAccount(req);
}
