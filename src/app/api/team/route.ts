import { connectDB } from '@/lib/db';
import { getEmployee, ok } from '@/lib/employeeAuth';
import { buildTeamOverview, emptyTeam } from '@/lib/hierarchy';
import type { TeamScope } from '@/lib/hierarchy';

export const dynamic = 'force-dynamic';

/**
 * GET /api/team
 *
 * Team members for the signed-in employee, scoped by their Bearer token.
 *   - default        -> direct reports only (BDM sees BDEs, ASM sees BDMs)
 *   - ?scope=all     -> the whole subtree (ASM sees BDMs and their BDEs)
 *
 * A BDE (or anyone with no reports) receives an empty members list, so the
 * existing mobile home screen keeps working unchanged.
 */
export async function GET(req: Request) {
  try {
    await connectDB();
    const employee = await getEmployee(req);

    if (!employee) {
      return ok(emptyTeam(), 'Unauthenticated');
    }

    const { searchParams } = new URL(req.url);
    const scope: TeamScope = searchParams.get('scope') === 'all' ? 'all' : 'direct';

    const team = await buildTeamOverview(employee, { scope });

    return ok(team, 'Team fetched successfully');
  } catch (error: any) {
    console.error('GET /api/team error:', error);
    return ok(emptyTeam(), 'Team unavailable');
  }
}
