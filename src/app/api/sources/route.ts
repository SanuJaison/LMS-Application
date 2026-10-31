import { NextResponse } from 'next/server';

/**
 * GET /api/sources
 * Returns the list of standard lead source options for Kerala Institute.
 */
export async function GET() {
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
