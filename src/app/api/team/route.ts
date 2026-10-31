import { connectDB } from '@/lib/db';
import { ok } from '@/lib/employeeAuth';
import { buildTeamOverview } from '@/lib/hierarchy';
import type { TeamScope } from '@/lib/hierarchy';
import { requireEmployee } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/team
 *
 * Team members for the signed-in employee, scoped by their Bearer token.
 *   - BDE        -> empty (no reports)
 *   - ASM / BDM  -> direct reports
 *   - SM         -> direct reports, or the whole subtree with ?scope=all
 *
 * Requires an employee token; no token returns 401.
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireEmployee(req);
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(req.url);
    const scope: TeamScope = searchParams.get('scope') === 'all' ? 'all' : 'direct';

    const team = await buildTeamOverview(guard.auth.employee, { scope });

    return ok(team, 'Team fetched successfully');
  } catch (error: any) {
    console.error('GET /api/team error:', error);
    return ok(
      {
        is_manager: false,
        role: 'OTHER',
        scope: 'direct',
        manager: null,
        members: [],
        totals: {
          members: 0,
          tasks_total: 0,
          tasks_completed: 0,
          tasks_pending: 0,
          leads_total: 0,
        },
      },
      'Team unavailable'
    );
  }
}
