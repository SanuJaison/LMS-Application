import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Employee } from '@/models/employee';
import { Lead } from '@/models/lead';
import { Attendance } from '@/models/attendence';
import { EmployeeTask } from '@/models/employeeTask';
import { Task, Wallet } from '@/models';
import { hierarchyRole } from '@/lib/hierarchy';
import { numericId, todayKey, formatHoursWorked } from '@/lib/employeeAuth';
import {
  getScope,
  leadScopeFilter,
  requireEmployee,
  scopeFilter,
  type Scope,
} from '@/lib/apiAuth';

/**
 * GET /api/home
 *
 * One endpoint, three role-specific dashboards:
 *   - BDE  -> only their own leads, wallet, attendance and performance
 *   - ASM  -> their own data + the BDEs that report to them
 *   - SM   -> their own data + every ASM and BDE below them
 *
 * Requires an employee Bearer token. There is no "first active employee"
 * fallback any more: no token returns 401.
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireEmployee(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const employee = auth.employee;
    const employeeId = auth.employeeId;
    const employeeName = auth.name;
    const role = hierarchyRole(employee);

    const scope = await getScope(auth);
    const leads = (await Lead.find(leadScopeFilter(scope)).lean()) as any[];

    // ---------------------------------------------------------------- own data
    const ownLeads = leads.filter((lead) => belongsTo(lead, employeeId, employeeName));

    const today = todayKey();
    const todayAtt: any = await Attendance.findOne({
      $or: [
        { employee_id: employeeId, date: today },
        { name: new RegExp(`^${escape(employeeName)}$`, 'i'), date: today },
      ],
    }).lean();

    const isCheckedIn = Boolean(
      todayAtt &&
      todayAtt.check_in &&
      (todayAtt.status === 'ONLINE' || !todayAtt.check_out)
    );
    const checkInTime = todayAtt?.check_in || '';
    const checkOutTime = isCheckedIn ? '' : (todayAtt?.check_out || '');
    const shiftStatus = todayAtt
      ? (isCheckedIn ? 'ONLINE' : (todayAtt.check_out ? 'COMPLETED' : 'OFFLINE'))
      : 'NOT_STARTED';

    const wallet: any = await Wallet.findOne({
      $or: [
        { employee_id: employeeId },
        { employee: new RegExp(`^${escape(employeeName)}$`, 'i') },
      ],
    }).lean();

    // ------------------------------------------------- targets + assigned tasks
    const todayIso = todayKey();
    const monthKey = todayIso.slice(0, 7); // YYYY-MM
    const visibleIds = scope.ids;
    const visibleNames = scope.names;

    const [targetRows, taskRows] = await Promise.all([
      EmployeeTask.find({
        $or: [
          ...(visibleIds.length > 0 ? [{ employee_id: { $in: visibleIds } }] : []),
          ...visibleNames.map((n) => ({
            employee: new RegExp(`^${escape(n)}$`, 'i'),
          })),
        ],
      })
        .sort({ createdAt: -1 })
        .lean(),
      Task.find({
        $or: [
          ...(visibleIds.length > 0 ? [{ assigned_to_id: { $in: visibleIds } }] : []),
          ...visibleNames.map((n) => ({
            assigned_to: new RegExp(`^${escape(n)}$`, 'i'),
          })),
        ],
      }).lean(),
    ]);

    // BDE: own leads. ASM: own + BDEs. SM: own + ASMs + BDEs (statewide).
    const scopedLeads = role === 'BDE' ? ownLeads : leads;

    // Targets specifically assigned to this user
    const myTargetRows = (targetRows as any[]).filter(
      (t) =>
        (employeeId && t.employee_id === employeeId) ||
        (employeeName && String(t.employee || '').toLowerCase() === employeeName.toLowerCase())
    );

    const myTasks = (taskRows as any[]).filter(
      (t) =>
        (employeeId && t.assigned_to_id === employeeId) ||
        (employeeName && String(t.assigned_to || '').toLowerCase() === employeeName.toLowerCase())
    );

    // 1. Daily Target
    const dailyTargetRow =
      myTargetRows.find(
        (t) =>
          t.task_template?.toLowerCase().includes('daily') ||
          (t.period_start && String(t.period_start).slice(0, 10) === todayIso)
      ) ||
      myTargetRows.find((t) => !t.task_template?.toLowerCase().includes('monthly')) ||
      (targetRows as any[]).find(
        (t) =>
          t.task_template?.toLowerCase().includes('daily') ||
          (t.period_start && String(t.period_start).slice(0, 10) === todayIso)
      );

    const dailyTaskRow = myTasks.find(
      (t) =>
        (t.title?.toLowerCase().includes('daily') || t.task_template?.toLowerCase().includes('daily')) &&
        typeof t.target_count === 'number' &&
        t.target_count > 0
    );

    const dailyTarget =
      typeof dailyTargetRow?.total_target === 'number' && dailyTargetRow.total_target > 0
        ? dailyTargetRow.total_target
        : typeof dailyTaskRow?.target_count === 'number' && dailyTaskRow.target_count > 0
          ? dailyTaskRow.target_count
          : 15;

    // 2. Monthly Target
    const monthlyTargetRow =
      myTargetRows.find((t) => t.task_template?.toLowerCase().includes('monthly')) ||
      (targetRows as any[]).find((t) => t.task_template?.toLowerCase().includes('monthly'));

    const monthlyTaskRow = myTasks.find(
      (t) =>
        (t.title?.toLowerCase().includes('monthly') || t.task_template?.toLowerCase().includes('monthly')) &&
        typeof t.target_count === 'number' &&
        t.target_count > 0
    );

    const monthlyTarget =
      typeof monthlyTargetRow?.total_target === 'number' && monthlyTargetRow.total_target > 0
        ? monthlyTargetRow.total_target
        : typeof monthlyTaskRow?.target_count === 'number' && monthlyTaskRow.target_count > 0
          ? monthlyTaskRow.target_count
          : dailyTarget * 26;

    // Closed leads in scope
    const closedScopedLeads = scopedLeads.filter(isClosed);

    // Daily achieved = leads closed today
    const dailyAchieved = closedScopedLeads.filter((lead) => {
      const closedDate = getLeadClosedDate(lead);
      return closedDate && todayKey(closedDate) === todayIso;
    }).length;

    // Monthly achieved = leads closed this month
    const monthlyAchieved = closedScopedLeads.filter((lead) => {
      const closedDate = getLeadClosedDate(lead);
      return closedDate && todayKey(closedDate).slice(0, 7) === monthKey;
    }).length;

    const dailyRemaining = Math.max(0, dailyTarget - dailyAchieved);
    const dailyPercentage =
      dailyTarget > 0
        ? Math.min(100, Math.round((dailyAchieved / dailyTarget) * 100))
        : 0;

    const monthlyRemaining = Math.max(0, monthlyTarget - monthlyAchieved);
    const monthlyPercentage =
      monthlyTarget > 0
        ? Math.min(100, Math.round((monthlyAchieved / monthlyTarget) * 100))
        : 0;

    const tasksTotal = (taskRows as any[]).length;
    const tasksCompleted = (taskRows as any[]).filter(
      (t) => t.status === 'completed'
    ).length;

    // ------------------------------------------------------- role-scoped data

    const assignedLeads = scopedLeads.length;
    const followUpLeads = scopedLeads.filter(isFollowUp).length;
    const closedLeads = closedScopedLeads.length;
    const ownClosedLeads = ownLeads.filter(isClosed).length;

    const incentivesEarned =
      typeof wallet?.total_earned === 'number'
        ? wallet.total_earned
        : (role === 'BDE' ? ownClosedLeads * (typeof employee?.incentive === 'number' && employee.incentive > 0 ? employee.incentive : 1000) : 0);

    // Subordinates: only people below the caller (never team-wide).
    const subordinates =
      role === 'BDE'
        ? []
        : ((await Employee.find({
            employee_id: { $in: scope.ids.filter((id) => id !== employeeId) },
          }).lean()) as any[]);

    const bdeSubordinates = subordinates.filter((e) => hierarchyRole(e) === 'BDE');
    const asmSubordinates = subordinates.filter((e) => {
      const r = hierarchyRole(e);
      return r === 'ASM' || r === 'BDM';
    });

    const subordinateList = bdeSubordinates.map((bde) => {
      const bdeLeads = scopedLeads.filter((lead) =>
        belongsTo(lead, bde.employee_id, bde.name)
      );
      const bdeClosed = bdeLeads.filter(isClosed).length;
      const conv =
        bdeLeads.length > 0 ? Math.round((bdeClosed / bdeLeads.length) * 100) : 0;

      return {
        id: numericId(bde._id) || 1,
        employee_id: bde.employee_id || '',
        name: bde.name,
        designation: bde.designation || 'Business Development Executive',
        conversion_percentage: `${conv}%`,
        leads_assigned: `${bdeLeads.length}`,
        online_status: bde.status === 'active' ? 'ONLINE' : 'OFFLINE',
        online_time: '09:00 AM',
        location_lat: 10.0159,
        location_lng: 76.3419,
      };
    });

    const conversionRate =
      assignedLeads > 0 ? Math.round((closedLeads / assignedLeads) * 100) : 0;

    const rawSessions = Array.isArray(todayAtt?.sessions) ? todayAtt.sessions : [];
    const sanitizedSessions = rawSessions.map((s: any) => {
      const formatted = formatHoursWorked(s.hours_worked, s.check_in, s.check_out);
      return {
        ...s,
        check_in: s.check_in || '',
        check_out: s.check_out || '',
        hours_worked: formatted,
        hours_worked_formatted: formatted,
        latitude: typeof s.latitude === 'number' && !isNaN(s.latitude) ? s.latitude : 10.0159,
        longitude: typeof s.longitude === 'number' && !isNaN(s.longitude) ? s.longitude : 76.3419,
        location_lat: typeof s.latitude === 'number' && !isNaN(s.latitude) ? s.latitude : 10.0159,
        location_lng: typeof s.longitude === 'number' && !isNaN(s.longitude) ? s.longitude : 76.3419,
        address: s.address || '',
        notes: s.notes || '',
      };
    });

    const payload = {
      user: {
        id: numericId(employee?._id) || 101,
        employee_id: employeeId,
        name: employeeName,
        email: employee?.email || '',
        role,
      },
      designation_id: role === 'SM' ? 301 : role === 'ASM' ? 401 : 501,
      designation_name:
        employee?.designation ||
        (role === 'SM'
          ? 'Sales Manager'
          : role === 'ASM'
            ? 'Area Sales Manager'
            : 'Business Development Executive'),
      dashboard_type: role === 'SM' ? 'sm' : role === 'ASM' ? 'asm' : 'bde',
      team_name: employee?.team || '',
      scope: {
        role,
        visible_employees: scope.isAll ? 'all' : scope.ids.length,
        visible_bdes: bdeSubordinates.length,
        visible_asms: asmSubordinates.length,
      },
      attendance: {
        check_in_time: checkInTime,
        check_out_time: checkOutTime,
        shift_status: shiftStatus,
        is_checked_in: isCheckedIn,
        hours_worked: formatHoursWorked(todayAtt?.hours_worked, checkInTime, checkOutTime),
        hours_worked_formatted: formatHoursWorked(todayAtt?.hours_worked, checkInTime, checkOutTime),
        sessions: sanitizedSessions,
        location_lat: typeof todayAtt?.latitude === 'number' && !isNaN(todayAtt?.latitude) ? todayAtt.latitude : 10.0159,
        location_lng: typeof todayAtt?.longitude === 'number' && !isNaN(todayAtt?.longitude) ? todayAtt.longitude : 76.3419,
      },
      eod_sync: {
        tasks_completed: dailyAchieved,
        total_tasks: dailyTarget,
        completion_percentage: dailyPercentage,
      },
      operational_overview: {
        assigned_leads: assignedLeads,
        follow_up_leads: followUpLeads,
        closed_leads: closedLeads,
        incentives_earned: incentivesEarned,
      },
      targets: {
        daily_target: dailyTarget,
        daily_achieved: dailyAchieved,
        daily_remaining: dailyRemaining,
        daily_percentage: dailyPercentage,
        monthly_target: monthlyTarget,
        monthly_achieved: monthlyAchieved,
        monthly_remaining: monthlyRemaining,
        monthly_percentage: monthlyPercentage,
        period: monthKey,
      },
      tasks: {
        total: tasksTotal,
        completed: tasksCompleted,
        pending: tasksTotal - tasksCompleted,
        completion_percentage:
          tasksTotal > 0
            ? Math.round((tasksCompleted / tasksTotal) * 100)
            : 0,
      },
      team_metrics: {
        team_leads: assignedLeads,
        team_admissions: closedLeads,
        team_conversion: `${conversionRate}%`,
        visits_pending: followUpLeads,
      },
      team_subordinate_status: {
        bdes: subordinateList,
        asms: asmSubordinates.map((asm) => ({
          id: numericId(asm._id) || 1,
          employee_id: asm.employee_id || '',
          name: asm.name,
          designation: asm.designation || 'Area Sales Manager',
          team: asm.team || '',
          leads_assigned: `${scopedLeads.filter((l) => l.asm_id === asm.employee_id).length}`,
          online_status: asm.status === 'active' ? 'ONLINE' : 'OFFLINE',
        })),
      },
      territory_report: [
        {
          district_name: employee?.district || 'Ernakulam',
          target: 100,
          achieved: ownClosedLeads,
          growth_rate: '+12.5%',
        },
      ],
    };

    return NextResponse.json({
      success: true,
      message: `${role} home dashboard loaded`,
      data: payload,
    });
  } catch (error: any) {
    console.error('GET /api/home error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to load home dashboard' },
      { status: 500 }
    );
  }
}

function belongsTo(lead: any, employeeId: string, name: string): boolean {
  if (!lead) return false;
  const leadEmpId = String(lead.employee_id || lead.bde_id || lead.created_by_id || lead.assigned_to_id || '');
  const leadEmpName = String(lead.employee || lead.bde_name || lead.created_by || lead.assigned_to || '').toLowerCase();
  const callerName = (name || '').toLowerCase();
  if (employeeId && leadEmpId === employeeId) return true;
  if (callerName && leadEmpName === callerName) return true;
  return false;
}

function isClosed(lead: any): boolean {
  if (!lead) return false;
  const adm = String(lead.admission_status || '').toLowerCase();
  const statusStr = String(lead.status || '').toLowerCase();
  return (
    adm === 'admitted' ||
    adm === 'closed' ||
    adm === 'won' ||
    statusStr === 'admitted' ||
    statusStr === 'closed' ||
    statusStr === 'won' ||
    lead.status === 4 ||
    lead.status === 5
  );
}

function isFollowUp(lead: any): boolean {
  if (!lead) return false;
  // If the lead is already closed, it's counted as closed, not follow-up
  if (isClosed(lead)) return false;

  const adm = String(lead.admission_status || '').toLowerCase();
  const statusStr = String(lead.status || '').toLowerCase();

  if (
    adm.includes('follow') ||
    adm === 'interested' ||
    statusStr.includes('follow') ||
    statusStr === 'interested' ||
    lead.status === 2 ||
    lead.status === 3
  ) {
    return true;
  }

  if (lead.next_followup_date && String(lead.next_followup_date).trim() !== '') {
    return true;
  }

  if (Array.isArray(lead.followups) && lead.followups.length > 0) {
    const hasFollowup = lead.followups.some((f: any) => {
      const s = String(f?.admission_status || f?.type || '').toLowerCase();
      return !s.includes('admit') && !s.includes('close') && !s.includes('won');
    });
    if (hasFollowup) return true;
  }

  return false;
}

function getLeadClosedDate(lead: any): Date | null {
  if (!isClosed(lead)) return null;
  if (lead.admission_date) {
    const d = new Date(lead.admission_date);
    if (!isNaN(d.getTime())) return d;
  }
  if (Array.isArray(lead.followups)) {
    const admissionEntry = lead.followups.find((f: any) => {
      const s = String(f?.admission_status || f?.type || '').toLowerCase();
      return s.includes('admit') || s.includes('close') || s.includes('won');
    });
    if (admissionEntry?.date) {
      const d = new Date(admissionEntry.date);
      if (!isNaN(d.getTime())) return d;
    }
  }
  if (lead.updatedAt) {
    const d = new Date(lead.updatedAt);
    if (!isNaN(d.getTime())) return d;
  }
  if (lead.createdAt) {
    const d = new Date(lead.createdAt);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function escape(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
