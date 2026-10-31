import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';

/**
 * GET /api/sources
 * Returns the list of standard lead source options for Kerala Institute.
 * Requires a valid Bearer token.
 */
export async function GET(req: Request) {
  const guard = await requireAuth(req);
  if (!guard.ok) return guard.response;

  const sources = [
    { id: 1, name: 'College Visit' },
    { id: 2, name: 'Referral' },
    { id: 3, name: 'Seminar' },
    { id: 4, name: 'Event' },
    { id: 5, name: 'Campus Drive / College Seminar' },
    { id: 6, name: 'Social Media' },
    { id: 7, name: 'Website Inquiry' },
    { id: 8, name: 'Direct Inflow' },
  ];

  return NextResponse.json({
    success: true,
    data: sources,
  });
}
