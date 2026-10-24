import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/leads/import
 *
 * Bulk CSV/Excel import is not implemented in this backend yet. Kept so the
 * client gets a clear JSON answer instead of an HTML 404.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message: 'Bulk lead import is not available yet. Please add leads individually.',
    },
    { status: 501 }
  );
}
