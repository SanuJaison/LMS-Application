import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Team } from '@/models';
import { Employee } from '@/models/employee';
import { getScope, requireAuth } from '@/lib/apiAuth';
import { resolveTeamForEmployee } from '@/lib/hierarchy';

export const dynamic = 'force-dynamic';

/**
 * GET /api/teams
 * The 8 teams managed by the Sales Manager (7 regional + 1 office).
 *
 *   - admin     -> every team
 *   - SM        -> every team led by one of its ASMs / office lead
 *   - ASM / BDE -> only its own team
 *
 * Requires a valid token. This is the list the SM uses before assigning a task
 * with `POST /api/tasks { "team": "EKM Team", ... }`.
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const scope = await getScope(auth);
    const { searchParams } = new URL(req.url);

    const wanted = (searchParams.get('team') || searchParams.get('name') || '')
      .trim();

    let teams: any[] = await Team.find({}).sort({ is_office: 1, name: 1 }).lean();

    if (!auth.isAdmin) {
      if (auth.role === 'SM') {
        // Only teams whose lead is inside the SM's reporting subtree.
        teams = teams.filter((team) => {
          const lead = parseTeamLead(team.team_lead);
          return (
            (lead.employeeId && scope.idSet.has(lead.employeeId)) ||
            (lead.name && scope.names.some((n) => n.toLowerCase() === lead.name.toLowerCase()))
          );
        });
      } else {
        const ownTeam = await resolveTeamForEmployee(auth.employee);
        teams = teams.filter(
          (team) =>
            String(team.name || '').toLowerCase() === ownTeam.toLowerCase()
        );
      }
    }

    if (wanted) {
      teams = teams.filter(
        (team) => String(team.name || '').toLowerCase() === wanted.toLowerCase()
      );
    }

    // Member counts from the reporting hierarchy, not the stored counter.
    const employees: any[] = await Employee.find({ status: 'active' })
      .select('employee_id name team reports_to designation')
      .lean();

    const data = teams.map((team) => {
      const lead = parseTeamLead(team.team_lead);
      const members = employees.filter(
        (e) => String(e.team || '').toLowerCase() === String(team.name || '').toLowerCase()
      );
      return {
        id: team._id.toString(),
        name: team.name,
        districts: team.districts || (team.district ? [team.district] : []),
        zone: team.zone || '',
        team_lead: team.team_lead || '',
        team_lead_id: lead.employeeId,
        is_office: Boolean(team.is_office),
        description: team.description || '',
        members_count: members.length,
        members: members.map((e) => ({
          employee_id: e.employee_id,
          name: e.name,
          designation: e.designation || '',
          reports_to: e.reports_to || '',
        })),
      };
    });

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error: any) {
    console.error('GET /api/teams error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch teams' },
      { status: 500 }
    );
  }
}

function parseTeamLead(teamLead: string): { name: string; employeeId: string } {
  const raw = String(teamLead || '').trim();
  const match = raw.match(/^(.*?)\s*\((.*?)\)\s*$/);
  if (match) return { name: match[1].trim(), employeeId: match[2].trim() };
  return { name: raw, employeeId: '' };
}
