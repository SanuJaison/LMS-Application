import { EmployeeTask } from '@/models/employeeTask';
import { Lead } from '@/models/lead';
import { Employee } from '@/models/employee';
import { escapeRegex, todayKey } from '@/lib/employeeAuth';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function currentMonthBoundsIst(): {
  monthKey: string;
  periodStart: string;
  periodEnd: string;
  todayIso: string;
} {
  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const year = istNow.getUTCFullYear();
  const month = istNow.getUTCMonth(); // 0-indexed
  const day = istNow.getUTCDate();

  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lastDd = String(lastDay).padStart(2, '0');

  return {
    monthKey: `${year}-${mm}`,
    periodStart: `${year}-${mm}-01`,
    periodEnd: `${year}-${mm}-${lastDd}`,
    todayIso: `${year}-${mm}-${dd}`,
  };
}

function parseSingleTarget(val: any): { value: number; present: boolean } {
  if (val === undefined || val === null || val === '') {
    return { value: 0, present: false };
  }
  if (typeof val === 'number' && !isNaN(val)) {
    return { value: Math.max(0, val), present: true };
  }
  if (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val))) {
    return { value: Math.max(0, Number(val)), present: true };
  }
  if (typeof val === 'object') {
    const nested =
      val.total_leads ??
      val.target ??
      val.total_target ??
      val.value ??
      val.count;
    if (nested !== undefined && nested !== null && nested !== '' && !isNaN(Number(nested))) {
      return { value: Math.max(0, Number(nested)), present: true };
    }
  }
  return { value: 0, present: false };
}

export function parseTargetInput(body: any): {
  dailyTarget: number;
  monthlyTarget: number;
  hasDaily: boolean;
  hasMonthly: boolean;
} {
  if (!body || typeof body !== 'object') {
    return { dailyTarget: 0, monthlyTarget: 0, hasDaily: false, hasMonthly: false };
  }

  const rawDaily =
    body.daily_target ??
    body.dailyTarget ??
    body.daily_leads_target ??
    body.targets?.daily_target ??
    body.targets?.dailyTarget ??
    body.targets?.daily;

  const rawMonthly =
    body.monthly_target ??
    body.monthlyTarget ??
    body.monthly_leads_target ??
    body.targets?.monthly_target ??
    body.targets?.monthlyTarget ??
    body.targets?.monthly;

  const d = parseSingleTarget(rawDaily);
  const m = parseSingleTarget(rawMonthly);

  return {
    dailyTarget: d.value,
    monthlyTarget: m.value,
    hasDaily: d.present,
    hasMonthly: m.present,
  };
}

function roleLabelFor(designation?: string, employeeId?: string): 'SM' | 'ASM' | 'BDE' {
  const id = String(employeeId || '').trim().toUpperCase();
  const des = String(designation || '').trim().toLowerCase();
  if (id.startsWith('SM') || (des.includes('sales manager') && !des.includes('area'))) {
    return 'SM';
  }
  if (
    id.startsWith('ASM') ||
    des.includes('area sales manager') ||
    des.includes('office team lead')
  ) {
    return 'ASM';
  }
  return 'BDE';
}

export async function syncEmployeeTargets(
  emp: { employee_id: string; name: string; designation?: string },
  dailyTarget?: number,
  monthlyTarget?: number
): Promise<void> {
  if (!emp || !emp.employee_id) return;

  const { monthKey, periodStart, periodEnd } = currentMonthBoundsIst();
  const roleLabel = roleLabelFor(emp.designation, emp.employee_id);
  const empIdRegex = new RegExp(`^${escapeRegex(emp.employee_id)}$`, 'i');

  if (roleLabel === 'SM') {
    // SM never has a daily target; remove any accidental daily SM target rows
    await EmployeeTask.deleteMany({
      $or: [
        { employee_id: empIdRegex, task_template: /daily/i },
        { task_template: /daily\s+sm\s+target/i },
      ],
    }).catch(() => {});
  } else if (dailyTarget !== undefined && !isNaN(Number(dailyTarget))) {
    const val = Math.max(0, Number(dailyTarget));
    const existingDaily: any = await EmployeeTask.findOne({
      employee_id: empIdRegex,
      task_template: /daily/i,
      period_start: new RegExp(`^${monthKey}`),
    }).sort({ createdAt: -1 });

    if (existingDaily) {
      existingDaily.employee = emp.name;
      existingDaily.total_target = val;
      existingDaily.period_start = periodStart;
      existingDaily.period_end = periodEnd;
      await existingDaily.save();
    } else if (val > 0) {
      await EmployeeTask.create({
        employee: emp.name,
        employee_id: emp.employee_id,
        task_template: `Daily ${roleLabel} Target`,
        period_start: periodStart,
        period_end: periodEnd,
        total_target: val,
        achieved: 0,
        is_completed: false,
        metric_type: 'Leads Generated',
      });
    }
  }

  if (monthlyTarget !== undefined && !isNaN(Number(monthlyTarget))) {
    const val = Math.max(0, Number(monthlyTarget));
    const existingMonthly: any = await EmployeeTask.findOne({
      employee_id: empIdRegex,
      task_template: /monthly/i,
      period_start: new RegExp(`^${monthKey}`),
    }).sort({ createdAt: -1 });

    if (existingMonthly) {
      existingMonthly.employee = emp.name;
      existingMonthly.total_target = val;
      existingMonthly.period_start = periodStart;
      existingMonthly.period_end = periodEnd;
      await existingMonthly.save();
    } else if (val > 0) {
      await EmployeeTask.create({
        employee: emp.name,
        employee_id: emp.employee_id,
        task_template: `Monthly ${roleLabel} Target`,
        period_start: periodStart,
        period_end: periodEnd,
        total_target: val,
        achieved: 0,
        is_completed: false,
        metric_type: 'Leads Generated',
      });
    }
  }
}

export function resolveEmployeeTargets(
  emp: any,
  allEmployeeTasks: any[]
): { daily_target: number; monthly_target: number } {
  const empId = String(emp?.employee_id || '').trim().toLowerCase();
  const empName = String(emp?.name || '').trim().toLowerCase();
  const roleLabel = roleLabelFor(emp?.designation, emp?.employee_id);
  const { monthKey } = currentMonthBoundsIst();

  const myTasks = (Array.isArray(allEmployeeTasks) ? allEmployeeTasks : []).filter((t: any) => {
    const tId = String(t?.employee_id || '').trim().toLowerCase();
    const tName = String(t?.employee || '').trim().toLowerCase();
    return Boolean((empId && tId === empId) || (empName && tName === empName));
  });

  const sortTasks = (rows: any[]) =>
    [...rows].sort((a, b) => {
      const aCurrent = String(a?.period_start || '').slice(0, 7) === monthKey ? 1 : 0;
      const bCurrent = String(b?.period_start || '').slice(0, 7) === monthKey ? 1 : 0;
      if (aCurrent !== bCurrent) return bCurrent - aCurrent;
      const bTime = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
      const aTime = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
      return bTime - aTime;
    });

  const dailyRows = sortTasks(
    myTasks.filter((t: any) => /daily/i.test(String(t?.task_template || '')))
  );
  const monthlyRows = sortTasks(
    myTasks.filter((t: any) => /monthly/i.test(String(t?.task_template || '')))
  );

  const dailyFromTask =
    dailyRows[0] && typeof dailyRows[0].total_target === 'number'
      ? dailyRows[0].total_target
      : undefined;
  const monthlyFromTask =
    monthlyRows[0] && typeof monthlyRows[0].total_target === 'number'
      ? monthlyRows[0].total_target
      : undefined;

  const dailyFromEmp =
    typeof emp?.daily_target === 'number' && !isNaN(emp.daily_target)
      ? emp.daily_target
      : 0;
  const monthlyFromEmp =
    typeof emp?.monthly_target === 'number' && !isNaN(emp.monthly_target)
      ? emp.monthly_target
      : 0;

  return {
    daily_target:
      roleLabel === 'SM'
        ? 0
        : dailyFromTask !== undefined && dailyFromTask > 0
          ? dailyFromTask
          : dailyFromEmp,
    monthly_target:
      monthlyFromTask !== undefined && monthlyFromTask > 0 ? monthlyFromTask : monthlyFromEmp,
  };
}

export function isClosedLeadRecord(lead: any): boolean {
  if (!lead) return false;
  const adm = String(lead.admission_status || '').toLowerCase().trim();
  const statusStr = String(lead.status || '').toLowerCase().trim();
  return (
    adm === 'admitted' ||
    adm === 'closed' ||
    adm === 'won' ||
    statusStr === 'admitted' ||
    statusStr === 'closed' ||
    statusStr === 'won' ||
    lead.status === 4 ||
    lead.status === 5 ||
    statusStr === '4' ||
    statusStr === '5'
  );
}

export function getClosedLeadDate(lead: any): Date {
  if (lead?.admission_date) {
    const d = new Date(lead.admission_date);
    if (!isNaN(d.getTime())) return d;
  }
  if (Array.isArray(lead?.followups)) {
    const admissionEntry = lead.followups.find((f: any) => {
      const s = String(f?.admission_status || f?.type || '').toLowerCase();
      return s.includes('admit') || s.includes('close') || s.includes('won');
    });
    if (admissionEntry?.date) {
      const d = new Date(admissionEntry.date);
      if (!isNaN(d.getTime())) return d;
    }
  }
  if (lead?.updatedAt) {
    const d = new Date(lead.updatedAt);
    if (!isNaN(d.getTime())) return d;
  }
  if (lead?.createdAt) {
    const d = new Date(lead.createdAt);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

/**
 * Recalculates and updates `achieved` and `is_completed` on current-month
 * EmployeeTask documents (SM, ASM, BDE) whenever a lead is closed.
 */
export async function syncAllEmployeeTaskAchievements(): Promise<void> {
  try {
    const { monthKey, todayIso } = currentMonthBoundsIst();

    // Remove any daily SM target rows if present
    await EmployeeTask.deleteMany({
      $or: [
        { employee_id: /^SM/i, task_template: /daily/i },
        { task_template: /daily\s+sm\s+target/i },
      ],
    }).catch(() => {});

    const [allLeads, allEmployees, currentTasks] = await Promise.all([
      Lead.find({}).lean(),
      Employee.find({}).select('employee_id name designation reports_to team').lean(),
      EmployeeTask.find({
        $or: [
          { period_start: new RegExp(`^${monthKey}`) },
          { task_template: /target/i },
        ],
      }).lean(),
    ]);

    const closedLeads = (allLeads as any[]).filter(isClosedLeadRecord);
    const closedThisMonth = closedLeads.filter(
      (l) => todayKey(getClosedLeadDate(l)).slice(0, 7) === monthKey
    );
    const closedToday = closedLeads.filter(
      (l) => todayKey(getClosedLeadDate(l)) === todayIso
    );

    const employees = allEmployees as any[];

    for (const task of currentTasks as any[]) {
      const taskEmpId = String(task.employee_id || '').trim();
      const taskEmpName = String(task.employee || '').trim();
      const template = String(task.task_template || '').toLowerCase();
      const isDaily = template.includes('daily');
      const role = roleLabelFor(
        template.includes('sm')
          ? 'Sales Manager'
          : template.includes('asm')
            ? 'Area Sales Manager'
            : undefined,
        taskEmpId
      );

      let achieved = 0;

      if (role === 'SM') {
        // SM target is statewide across all BDEs
        achieved = closedThisMonth.length;
      } else if (role === 'ASM') {
        const subBdes = employees.filter(
          (e) =>
            String(e.reports_to || '').trim().toLowerCase() === taskEmpId.toLowerCase()
        );
        const validIds = new Set(
          [taskEmpId, ...subBdes.map((b) => String(b.employee_id || ''))]
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
        );
        const validNames = new Set(
          [taskEmpName, ...subBdes.map((b) => String(b.name || ''))]
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
        );
        const sourceList = isDaily ? closedToday : closedThisMonth;
        achieved = sourceList.filter((l) => {
          const lEmpId = String(l.employee_id || l.bde_id || '').trim().toLowerCase();
          const lAsmId = String(l.asm_id || '').trim().toLowerCase();
          const lEmpName = String(l.employee || l.bde_name || '').trim().toLowerCase();
          return (
            (lEmpId && validIds.has(lEmpId)) ||
            (lAsmId && validIds.has(lAsmId)) ||
            (lEmpName && validNames.has(lEmpName))
          );
        }).length;
      } else {
        const sourceList = isDaily ? closedToday : closedThisMonth;
        achieved = sourceList.filter((l) => {
          const lEmpId = String(l.employee_id || l.bde_id || '').trim().toLowerCase();
          const lEmpName = String(l.employee || l.bde_name || '').trim().toLowerCase();
          return (
            (taskEmpId && lEmpId === taskEmpId.toLowerCase()) ||
            (taskEmpName && lEmpName === taskEmpName.toLowerCase())
          );
        }).length;
      }

      const totalTarget = Number(task.total_target || 0);
      const isCompleted = totalTarget > 0 && achieved >= totalTarget;

      if (task.achieved !== achieved || task.is_completed !== isCompleted) {
        await EmployeeTask.findByIdAndUpdate(task._id, {
          achieved,
          is_completed: isCompleted,
        });
      }
    }
  } catch (err) {
    console.error('syncAllEmployeeTaskAchievements error:', err);
  }
}
