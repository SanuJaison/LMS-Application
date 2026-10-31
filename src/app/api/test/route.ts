import { NextResponse } from 'next/server';
import { checkServerStatus } from '../server';
import { requireAdmin } from '@/lib/adminAuth';

/**
 * GET /api/test
 * Quick endpoint to test the MongoDB connection (admin only).
 */
export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const status = await checkServerStatus();
  return NextResponse.json(status, { status: status.success ? 200 : 500 });
}
