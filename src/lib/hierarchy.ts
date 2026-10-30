import { Attendance } from '@/models/attendence';
import { Employee } from '@/models/employee';
import { EmployeeTask } from '@/models/employeeTask';
import { Lead } from '@/models/lead';
import { Leave, Team } from '@/models';
import {
  escapeRegex,
  nameRegex,
  numericId,
  todayKey,
} from '@/lib/employeeAuth';

export type HierarchyRole = 'ASM' | 'BDM' | 'BDE' | 'SM' | 'MD' | 'OTHER';
export type TeamScope = 'direct' | 'all';

const MANAGER_ROLES: HierarchyRole[] = ['ASM', 'BDM', 'SM', 'MD'];

/**
 * Derive the hierarchy role from the employee ID prefix first, then the
 * designation text. The ID prefix is the reliable signal because designation
 * names have historically been typed inconsistently (e.g. "Bussinss
 * Development Executive" on a BDM-prefixed account).
 */
export function hierarchyRole(employee: any): HierarchyRole {
  const id = String(employee?.employee_id || '').trim().toUpperCase();
  const designation = String(employee?.designation || '').trim().toLowerCase();

  if (id.startsWith('ASM') || designation.includes('area sales manager')) return 'ASM';
  if (
    id.startsWith('BDM') ||
    designation.includes('business development manager') ||
    designation.includes('bussiness development manager') ||
    designation.includes('bussinss development manager')
  ) {
    return 'BDM';
  }
  if (id.startsWith('BDE') || designation.includes('business development executive')) return 'BDE';
  if (id.startsWith('SM') || designation.includes('sales manager')) return 'SM';
  if (id.startsWith('MD') || designation.includes('managing director')) return 'MD';
  return 'OTHER';
}

export function isManagerRole(employee: any): boolean {
  return MANAGER_ROLES.includes(hierarchyRole(employee));
}

async function teamLedBy(name: string): Promise<string> {
  const lead = String(name || '').trim();
  if (!lead) return '';
  const team: any = await Team.findOne({
    team_lead: { $regex: `^${escapeRegex(lead)}$`, $options: 'i' },
  }).lean();
  return team?.name || '';
}

/**
 * Resolve an employee's team from the Teams collection instead of the employee
 * record:
 *   - ASM   -> the team they lead
 *   - BDE   -> the team led by the first ASM up their reporting chain
 *   - SM/MD -> no team (top level)
 * Falls back to the stored `team` only when no team assignment is found.
 */
export async function resolveTeamForEmployee(employee: any): Promise<string> {
  if (!employee) return '';

  const role = hierarchyRole(employee);
  if (role === 'MD') return '';

  const directlyLed =
    (await teamLedBy(employee.name)) ||
    (await teamLedBy(employee.employee_id));
  if (directlyLed) return directlyLed;

  if (role === 'SM' || role === 'ASM') {
    return String(employee.team || '');
  }

  let managerId = String(employee.reports_to || '').trim();
  const seen = new Set<string>();

  while (managerId && !seen.has(managerId)) {
    seen.add(managerId);
    const manager: any = await Employee.findOne({
      employee_id: { $regex: `^${escapeRegex(managerId)}$`, $options: 'i' },
    }).lean();
    if (!manager) break;

    const managerRole = hierarchyRole(manager);
    if (managerRole === 'ASM') {
      return (await teamLedBy(manager.name)) || String(employee.team || '');
    }
    if (managerRole === 'SM' || managerRole === 'MD') break;

    managerId = String(manager.reports_to || '').trim();
  }

  return String(employee.team || '');
}

/**
 * Same team resolution for a list of employees, without extra queries.
 * Returns a map of EMPLOYEE_ID -> team name.
 */
export function teamNamesFromTeams(
  employees: any[],
  teams: any[]
): Map<string, string> {
  const leadToTeam = new Map<string, string>();
  for (const team of teams) {
    const lead = String(team.team_lead || '').trim().toLowerCase();
    if (lead) {
      leadToTeam.set(lead, team.name || '');
      const match = lead.match(/^(.*?)\s*\((.*?)\)$/);
      if (match) {
        leadToTeam.set(match[1].trim().toLowerCase(), team.name || '');
        leadToTeam.set(match[2].trim().toLowerCase(), team.name || '');
      }
    }
  }

  const byId = new Map<string, any>();
  for (const emp of employees) {
    const id = String(emp.employee_id || '').trim().toUpperCase();
    if (id) byId.set(id, emp);
  }

  const cache = new Map<string, string>();
  const resolve = (emp: any, depth = 0): string => {
    if (!emp || depth > 10) return '';
    const id = String(emp.employee_id || '').trim().toUpperCase();
    if (id && cache.has(id)) return cache.get(id)!;

    const role = hierarchyRole(emp);
    const empName = String(emp.name || '').trim().toLowerCase();
    const empId = String(emp.employee_id || '').trim().toLowerCase();
    const directlyLed = leadToTeam.get(empName) || leadToTeam.get(empId) || '';

    let team = '';

    if (directlyLed) {
      team = directlyLed;
    } else if (role === 'ASM' || role === 'SM') {
      team = String(emp.team || '');
    } else if (role !== 'MD') {
      const managerId = String(emp.reports_to || '').trim().toUpperCase();
      const manager = managerId ? byId.get(managerId) : null;
      if (manager) team = resolve(manager, depth + 1);
    }

    if (!team && role !== 'MD') {
      team = directlyLed || String(emp.team || '');
    }

    if (id) cache.set(id, team);
    return team;
  };

  const out = new Map<string, string>();
  for (const emp of employees) {
    const id = String(emp.employee_id || '').trim().toUpperCase();
    out.set(id, resolve(emp));
  }
  return out;
}

/**
 * Direct reports are employees whose `reports_to` matches this employee's ID.
 * Inactive accounts are excluded from the mobile team view.
 */
export async function getDirectReports(manager: any): Promise<any[]> {
  const managerId = String(manager?.employee_id || '').trim();
  if (!managerId) return [];

  const reports = (await Employee.find({
    reports_to: { $regex: `^${escapeRegex(managerId)}$`, $options: 'i' },
  }).lean()) as any[];

  return reports.filter(
    (report) =>
      String(report._id) !== String(manager?._id) &&
      String(report.status || '').toLowerCase() !== 'inactive'
  );
}

/**
 * Direct reports, or the whole subtree when scope is "all". Cycle-safe and
 * capped at five levels so a bad reporting line can never loop forever.
 */
export async function getTeamMembers(
  manager: any,
  scope: TeamScope = 'direct'
): Promise<any[]> {
  const direct = await getDirectReports(manager);
  if (scope !== 'all') return direct;

  const members: any[] = [];
  const seen = new Set<string>([String(manager?._id || '')]);
  let frontier = direct;
  let depth = 0;

  while (frontier.length > 0 && depth < 5) {
    for (const member of frontier) {
      const key = String(member._id || member.employee_id || '');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      members.push(member);
    }

    const next: any[] = [];
    for (const member of frontier) {
      const reports = await getDirectReports(member);
      for (const report of reports) {
        const key = String(report._id || report.employee_id || '');
        if (key && !seen.has(key)) next.push(report);
      }
    }

    frontier = next;
    depth += 1;
  }

  return members;
}

function taskQueryFor(member: any) {
  const conditions: any[] = [];
  const employeeId = String(member?.employee_id || '').trim();
  const memberName = nameRegex(member?.name);

  if (employeeId) conditions.push({ employee_id: employeeId });
  if (memberName) conditions.push({ employee: memberName });

  return conditions.length ? { $or: conditions } : { employee_id: '__none__' };
}

function leadQueryFor(member: any) {
  const conditions: any[] = [];
  const employeeId = String(member?.employee_id || '').trim();
  const memberName = nameRegex(member?.name);

  if (memberName) conditions.push({ employee: memberName });
  if (employeeId) conditions.push({ employee_id: employeeId });

  return conditions.length ? { $or: conditions } : { employee: '__none__' };
}

async function buildMember(
  member: any,
  today: string,
  startOfToday: Date,
  teamMap?: Map<string, string>
) {
  const memberName = nameRegex(member?.name);
  const leaveQuery = memberName ? { employee: memberName } : { employee: '__none__' };
  const attendanceQuery = memberName
    ? { name: memberName, date: today }
    : { name: '__none__', date: today };

  const [tasks, attendance, leads, leaves] = await Promise.all([
    EmployeeTask.find(taskQueryFor(member)).sort({ createdAt: -1 }).lean(),
    Attendance.findOne(attendanceQuery).lean(),
    Lead.find(leadQueryFor(member)).lean(),
    Leave.find(leaveQuery).lean(),
  ]);

  const taskList = tasks as any[];
  const leadList = leads as any[];
  const leaveList = leaves as any[];
  const attendanceDoc = attendance as any;

  const memberKey = String(member.employee_id || '').trim().toUpperCase();
  const resolvedTeam = teamMap?.has(memberKey)
    ? teamMap.get(memberKey) || ''
    : member.team || '';

  return {
    id: numericId(member._id),
    employee_id: member.employee_id || '',
    name: member.name || '',
    email: member.email || '',
    contact_number: member.contact_number || '',
    designation_name: member.designation || null,
    team: resolvedTeam,
    zone: member.zone || '',
    district: member.district || '',
    reports_to: member.reports_to || null,
    status: member.status || 'active',
    attendance: {
      date: today,
      status: attendanceDoc?.status || 'OFFLINE',
      check_in: attendanceDoc?.check_in || null,
      check_out: attendanceDoc?.check_out || null,
      hours_worked: attendanceDoc?.hours_worked || 0,
      checked_in: Boolean(attendanceDoc?.check_in),
      checked_out: Boolean(attendanceDoc?.check_out),
    },
    tasks: {
      total: taskList.length,
      completed: taskList.filter((task) => task.is_completed).length,
      pending: taskList.filter((task) => !task.is_completed).length,
      list: taskList.slice(0, 20),
    },
    leads: {
      total: leadList.length,
      today: leadList.filter((lead) => new Date(lead.createdAt) >= startOfToday).length,
      admitted: leadList.filter(
        (lead) => lead.admission_status === 'Admitted' || lead.status === 'Won'
      ).length,
    },
    leaves: {
      total: leaveList.length,
      pending: leaveList.filter((leave) => leave.status === 'Pending').length,
      approved: leaveList.filter((leave) => leave.status === 'Approved').length,
      rejected: leaveList.filter((leave) => leave.status === 'Rejected').length,
    },
  };
}

export function emptyTeam() {
  return {
    is_manager: false,
    role: 'OTHER' as HierarchyRole,
    scope: 'direct' as TeamScope,
    manager: null as null | { employee_id: string; name: string },
    members: [] as any[],
    totals: {
      members: 0,
      tasks_total: 0,
      tasks_completed: 0,
      tasks_pending: 0,
      leads_total: 0,
    },
  };
}

/**
 * Team overview used by /api/home and /api/team.
 *
 * Each member includes today's attendance plus task, lead and leave counts,
 * so the mobile home screen can render a manager's team in one request.
 */
export async function buildTeamOverview(
  manager: any,
  options: { scope?: TeamScope } = {}
) {
  if (!manager) return emptyTeam();

  const scope = options.scope === 'all' ? 'all' : 'direct';
  const members = await getTeamMembers(manager, scope);
  const today = todayKey();
  const startOfToday = new Date(`${today}T00:00:00.000Z`);

  const teams = (await Team.find({}, { name: 1, team_lead: 1 }).lean()) as any[];
  const teamMap = teamNamesFromTeams([manager, ...members], teams);

  const detailed = await Promise.all(
    members.map((member) => buildMember(member, today, startOfToday, teamMap))
  );

  const totals = detailed.reduce(
    (acc, member) => {
      acc.tasks_total += member.tasks.total;
      acc.tasks_completed += member.tasks.completed;
      acc.tasks_pending += member.tasks.pending;
      acc.leads_total += member.leads.total;
      return acc;
    },
    {
      members: detailed.length,
      tasks_total: 0,
      tasks_completed: 0,
      tasks_pending: 0,
      leads_total: 0,
    }
  );

  return {
    is_manager: isManagerRole(manager),
    role: hierarchyRole(manager),
    scope,
    manager: {
      employee_id: manager.employee_id || '',
      name: manager.name || '',
    },
    members: detailed,
    totals,
  };
}
