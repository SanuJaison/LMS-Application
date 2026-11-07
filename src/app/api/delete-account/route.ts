import { handleDeleteAccount } from '@/lib/deleteAccount';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/delete-account
 * POST   /api/delete-account
 *
 * Permanently deletes the employee account from MongoDB (Admin portal + Login).
 * Supports Bearer token authentication and/or passing `{ "employee_id": "..." }`.
 */
export async function DELETE(req: Request) {
  return handleDeleteAccount(req);
}

export async function POST(req: Request) {
  return handleDeleteAccount(req);
}
