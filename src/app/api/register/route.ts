import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/register
 *
 * Employee accounts are created by an admin in the CRM, not self-registered
 * from the mobile app. Kept so the client gets a clear JSON answer instead
 * of an HTML 404.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message: 'Self registration is disabled. Please contact your admin to create your account.',
    },
    { status: 403 }
  );
}
