import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/apiAuth';
import { buildTeamOverview } from '@/lib/hierarchy';

export const dynamic = 'force-dynamic';

/**
 * GET /api/hierarchy/team
 * Returns the reporting team hierarchy for the signed-in caller (SM, ASM, or BDE).
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const teamData = await buildTeamOverview(auth.employee || {
      employee_id: auth.employeeId,
      name: auth.name,
      team: auth.team,
      designation: auth.role,
    });

    return NextResponse.json({
      success: true,
      message: 'Team hierarchy loaded',
      data: teamData,
    });
  } catch (error: any) {
    console.error('GET /api/hierarchy/team error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to load team hierarchy' },
      { status: 500 }
    );
  }
}
