import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/leaves/balances
 * Returns standard leave balances for the signed-in employee.
 */
export async function GET(req: Request) {
  try {
    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;

    return NextResponse.json({
      success: true,
      message: 'Leave balances loaded',
      data: {
        casual: 12,
        medical: 8,
        earned: 15,
        total_remaining: 35,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch leave balances' },
      { status: 500 }
    );
  }
}
