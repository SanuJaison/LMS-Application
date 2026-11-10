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
 * Counts closed leads attributed to `emp` (BDE or ASM) whose IST completion date
 * satisfies `fromDateIso <= closedDateIso < toDateExclusiveIso`.
 */
export function countClosedLeadsBetweenDates(
  emp: { employee_id?: string; name?: string; designation?: string; team?: string },
  closedLeads: any[],
  allEmployees: any[],
  fromDateIso: string,
  toDateExclusiveIso: string
): number {
  const empId = String(emp?.employee_id || '').trim().toLowerCase();
  const empName = String(emp?.name || '').trim().toLowerCase();
  const empTeam = String(emp?.team || '').trim().toLowerCase();
  const role = roleLabelFor(emp?.designation, emp?.employee_id);

  if (role === 'SM') {
    return (Array.isArray(closedLeads) ? closedLeads : []).filter((l: any) => {
      const closedDateIso = todayKey(getClosedLeadDate(l));
      return closedDateIso >= fromDateIso && closedDateIso < toDateExclusiveIso;
    }).length;
  }

  let validIds = new Set<string>(empId ? [empId] : []);
  let validNames = new Set<string>(empName ? [empName] : []);

  if (role === 'ASM') {
    const subBdes = (Array.isArray(allEmployees) ? allEmployees : []).filter(
      (e: any) => String(e?.reports_to || '').trim().toLowerCase() === empId
    );
    subBdes.forEach((b: any) => {
      const bId = String(b?.employee_id || '').trim().toLowerCase();
      const bName = String(b?.name || '').trim().toLowerCase();
      if (bId) validIds.add(bId);
      if (bName) validNames.add(bName);
    });
  }

  return (Array.isArray(closedLeads) ? closedLeads : []).filter((l: any) => {
    const closedDateIso = todayKey(getClosedLeadDate(l));
    if (closedDateIso < fromDateIso || closedDateIso >= toDateExclusiveIso) {
      return false;
    }

    const lEmpId = String(l?.employee_id || l?.bde_id || '').trim().toLowerCase();
    const lAsmId = String(l?.asm_id || '').trim().toLowerCase();
    const lEmpName = String(l?.employee || l?.bde_name || '').trim().toLowerCase();
    const lTeam = String(l?.team || '').trim().toLowerCase();

    if (role === 'ASM') {
      if (lAsmId && lAsmId === empId) return true;
      if (empTeam && empTeam !== 'office team' && lTeam && lTeam === empTeam) return true;
      if (lEmpId && validIds.has(lEmpId)) return true;
      if (lEmpName && validNames.has(lEmpName)) return true;
      return false;
    }

    return (
      Boolean(empId && lEmpId === empId) ||
      Boolean(empName && lEmpName === empName)
    );
  }).length;
}

/**
 * Rolls over monthly targets for all employees (SM, ASM, BDE) when a new IST month begins:
 * - Uncompleted monthly target from previous month(s) carries over as `monthly_carryover`.
 * - If last month's target was completed and nothing is assigned this month yet, `monthly_target` becomes `0`.
 * - If last month had leftover and nothing is assigned this month yet, `monthly_target` shows the leftover.
 */
export async function rolloverMonthlyTargetsIfNeeded(
  targetEmployeeId?: string
): Promise<void> {
  try {
    const { monthKey, periodStart, periodEnd } = currentMonthBoundsIst();

    const query: Record<string, any> = targetEmployeeId
      ? { employee_id: new RegExp(`^${escapeRegex(targetEmployeeId)}$`, 'i') }
      : { monthly_target_month: { $ne: monthKey } };

    const candidates: any[] = await Employee.find(query).lean();
    if (candidates.length === 0) return;

    const needsWork = candidates.filter(
      (c) => String(c.monthly_target_month || '') !== monthKey
    );
    if (needsWork.length === 0) return;

    const [allLeads, allEmployees, allMonthlyTasks] = await Promise.all([
      Lead.find({}).lean(),
      Employee.find({})
        .select('employee_id name designation reports_to team')
        .lean(),
      EmployeeTask.find({ task_template: /monthly/i }).sort({ createdAt: -1 }).lean(),
    ]);

    const closedLeads = (allLeads as any[]).filter(isClosedLeadRecord);

    for (const emp of needsWork) {
      const empId = String(emp.employee_id || '').trim();
      if (!empId) continue;

      const roleLabel = roleLabelFor(emp.designation, empId);
      const empIdLower = empId.toLowerCase();
      const empNameLower = String(emp.name || '').trim().toLowerCase();

      const myMonthlyTask = (allMonthlyTasks as any[]).find(
        (t: any) =>
          String(t.employee_id || '').trim().toLowerCase() === empIdLower ||
          (empNameLower && String(t.employee || '').trim().toLowerCase() === empNameLower)
      );

      const storedMonth = String(emp.monthly_target_month || '').trim();
      const fallbackTarget =
        typeof emp.monthly_target === 'number' && emp.monthly_target > 0
          ? emp.monthly_target
          : typeof myMonthlyTask?.total_target === 'number' && myMonthlyTask.total_target > 0
            ? myMonthlyTask.total_target
            : 0;

      if (!storedMonth) {
        // Initialize tracking for the current month with the employee's current monthly target
        await Employee.updateOne(
          { _id: emp._id },
          {
            $set: {
              monthly_target_month: monthKey,
              monthly_carryover: 0,
              monthly_assigned: fallbackTarget,
              monthly_target: fallbackTarget,
            },
          }
        );
        continue;
      }

      if (storedMonth < monthKey) {
        const prevTotalTarget = Math.max(0, Number(emp.monthly_target ?? fallbackTarget ?? 0));
        const prevMonthStartIso = `${storedMonth}-01`;
        const currentMonthStartIso = `${monthKey}-01`;

        const completedInPrevMonths = countClosedLeadsBetweenDates(
          emp,
          closedLeads,
          allEmployees as any[],
          prevMonthStartIso,
          currentMonthStartIso
        );
        const newCarryover = Math.max(0, prevTotalTarget - completedInPrevMonths);

        await Employee.updateOne(
          { _id: emp._id },
          {
            $set: {
              monthly_target_month: monthKey,
              monthly_carryover: newCarryover,
              monthly_assigned: 0,
              monthly_target: newCarryover,
            },
          }
        );

        const empIdRegex = new RegExp(`^${escapeRegex(empId)}$`, 'i');
        const existingCurrentMonthly: any = await EmployeeTask.findOne({
          employee_id: empIdRegex,
          task_template: /monthly/i,
          period_start: new RegExp(`^${monthKey}`),
        }).sort({ createdAt: -1 });

        if (existingCurrentMonthly) {
          existingCurrentMonthly.total_target = newCarryover;
          existingCurrentMonthly.period_start = periodStart;
          existingCurrentMonthly.period_end = periodEnd;
          await existingCurrentMonthly.save();
        } else if (newCarryover > 0) {
          await EmployeeTask.create({
            employee: emp.name,
            employee_id: empId,
            task_template: `Monthly ${roleLabel} Target`,
            period_start: periodStart,
            period_end: periodEnd,
            total_target: newCarryover,
            achieved: 0,
            is_completed: false,
            metric_type: 'Leads Generated',
          });
        }
      }
    }
  } catch (err) {
    console.error('rolloverMonthlyTargetsIfNeeded error:', err);
  }
}

/**
 * Rolls over daily targets for all employees (or a single employee) when a new IST day begins:
 * - Uncompleted daily target from previous day(s) carries over as `daily_carryover`.
 * - If yesterday's target was completed and nothing is assigned today yet, `daily_target` becomes `0`.
 * - If yesterday had leftover and nothing is assigned today yet, `daily_target` shows the leftover.
 */
export async function rolloverDailyTargetsIfNeeded(
  targetEmployeeId?: string
): Promise<void> {
  try {
    await rolloverMonthlyTargetsIfNeeded(targetEmployeeId);
    const { monthKey, periodStart, periodEnd, todayIso } = currentMonthBoundsIst();

    const query: Record<string, any> = targetEmployeeId
      ? { employee_id: new RegExp(`^${escapeRegex(targetEmployeeId)}$`, 'i') }
      : { daily_target_date: { $ne: todayIso } };

    const candidates: any[] = await Employee.find(query).lean();
    if (candidates.length === 0) return;

    const needsWork = candidates.filter(
      (c) => String(c.daily_target_date || '') !== todayIso
    );
    if (needsWork.length === 0) return;

    const [allLeads, allEmployees, allDailyTasks] = await Promise.all([
      Lead.find({}).lean(),
      Employee.find({})
        .select('employee_id name designation reports_to team')
        .lean(),
      EmployeeTask.find({ task_template: /daily/i }).sort({ createdAt: -1 }).lean(),
    ]);

    const closedLeads = (allLeads as any[]).filter(isClosedLeadRecord);

    for (const emp of needsWork) {
      const empId = String(emp.employee_id || '').trim();
      if (!empId) continue;

      const roleLabel = roleLabelFor(emp.designation, empId);
      if (roleLabel === 'SM') {
        await Employee.updateOne(
          { _id: emp._id },
          {
            $set: {
              daily_target: 0,
              daily_target_date: todayIso,
              daily_carryover: 0,
              daily_assigned: 0,
            },
          }
        );
        continue;
      }

      const empIdLower = empId.toLowerCase();
      const empNameLower = String(emp.name || '').trim().toLowerCase();
      const myDailyTask = (allDailyTasks as any[]).find(
        (t: any) =>
          String(t.employee_id || '').trim().toLowerCase() === empIdLower ||
          (empNameLower && String(t.employee || '').trim().toLowerCase() === empNameLower)
      );

      const storedDate = String(emp.daily_target_date || '').trim();
      const fallbackTarget =
        typeof emp.daily_target === 'number' && emp.daily_target > 0
          ? emp.daily_target
          : typeof myDailyTask?.total_target === 'number' && myDailyTask.total_target > 0
            ? myDailyTask.total_target
            : 0;

      if (!storedDate) {
        // Initialize tracking for today with the employee's current daily target
        await Employee.updateOne(
          { _id: emp._id },
          {
            $set: {
              daily_target_date: todayIso,
              daily_carryover: 0,
              daily_assigned: fallbackTarget,
              daily_target: fallbackTarget,
            },
          }
        );
        continue;
      }

      if (storedDate < todayIso) {
        const prevTotalTarget = Math.max(0, Number(emp.daily_target ?? fallbackTarget ?? 0));
        const completedInPrevDays = countClosedLeadsBetweenDates(
          emp,
          closedLeads,
          allEmployees as any[],
          storedDate,
          todayIso
        );
        const newCarryover = Math.max(0, prevTotalTarget - completedInPrevDays);

        await Employee.updateOne(
          { _id: emp._id },
          {
            $set: {
              daily_target_date: todayIso,
              daily_carryover: newCarryover,
              daily_assigned: 0,
              daily_target: newCarryover,
            },
          }
        );

        const empIdRegex = new RegExp(`^${escapeRegex(empId)}$`, 'i');
        const existingDaily: any = await EmployeeTask.findOne({
          employee_id: empIdRegex,
          task_template: /daily/i,
        }).sort({ createdAt: -1 });

        if (existingDaily) {
          existingDaily.total_target = newCarryover;
          existingDaily.period_start = periodStart;
          existingDaily.period_end = periodEnd;
          await existingDaily.save();
        } else if (newCarryover > 0) {
          await EmployeeTask.create({
            employee: emp.name,
            employee_id: empId,
            task_template: `Daily ${roleLabel} Target`,
            period_start: periodStart,
            period_end: periodEnd,
            total_target: newCarryover,
            achieved: 0,
            is_completed: false,
            metric_type: 'Leads Generated',
          });
        }
      }
    }
  } catch (err) {
    console.error('rolloverDailyTargetsIfNeeded error:', err);
  }
}

/**
 * Assigns or edits an employee's daily and/or monthly target:
 * - First rolls over any uncompleted daily target from previous day(s) into `daily_carryover`.
 * - Sets today's `daily_assigned` to `dailyTarget` (so editing on the same day replaces today's assigned amount).
 * - Sets effective `daily_target = daily_carryover + daily_assigned` (so assigning on a new day adds to yesterday's leftover).
 */
export async function syncEmployeeTargets(
  emp: { employee_id: string; name: string; designation?: string },
  dailyTarget?: number,
  monthlyTarget?: number
): Promise<{
  daily_target: number;
  monthly_target: number;
  daily_carryover: number;
  daily_assigned: number;
  monthly_carryover: number;
  monthly_assigned: number;
}> {
  if (!emp || !emp.employee_id) {
    return {
      daily_target: 0,
      monthly_target: 0,
      daily_carryover: 0,
      daily_assigned: 0,
      monthly_carryover: 0,
      monthly_assigned: 0,
    };
  }

  const { monthKey, periodStart, periodEnd, todayIso } = currentMonthBoundsIst();
  const empIdRegex = new RegExp(`^${escapeRegex(emp.employee_id)}$`, 'i');

  // 1. Ensure any previous day's or previous month's leftover is rolled over first
  await rolloverDailyTargetsIfNeeded(emp.employee_id);

  const empDoc: any = await Employee.findOne({ employee_id: empIdRegex }).lean();
  const roleLabel = roleLabelFor(emp.designation || empDoc?.designation, emp.employee_id);

  let finalDaily = Number(empDoc?.daily_target ?? 0);
  let finalCarryover = Number(empDoc?.daily_carryover ?? 0);
  let finalAssigned = Number(empDoc?.daily_assigned ?? 0);
  let finalMonthly = Number(empDoc?.monthly_target ?? 0);
  let finalMonthlyCarryover = Number(empDoc?.monthly_carryover ?? 0);
  let finalMonthlyAssigned = Number(empDoc?.monthly_assigned ?? 0);

  if (roleLabel === 'SM') {
    finalDaily = 0;
    finalCarryover = 0;
    finalAssigned = 0;
    await EmployeeTask.deleteMany({
      $or: [
        { employee_id: empIdRegex, task_template: /daily/i },
        { task_template: /daily\s+sm\s+target/i },
      ],
    }).catch(() => {});
  } else if (dailyTarget !== undefined && !isNaN(Number(dailyTarget))) {
    const val = Math.max(0, Number(dailyTarget));
    finalCarryover =
      empDoc?.daily_target_date === todayIso
        ? Math.max(0, Number(empDoc?.daily_carryover ?? 0))
        : 0;
    finalAssigned = val;
    finalDaily = finalCarryover + finalAssigned;

    await Employee.updateOne(
      { employee_id: empIdRegex },
      {
        $set: {
          daily_target_date: todayIso,
          daily_carryover: finalCarryover,
          daily_assigned: finalAssigned,
          daily_target: finalDaily,
        },
      }
    );

    const existingDaily: any = await EmployeeTask.findOne({
      employee_id: empIdRegex,
      task_template: /daily/i,
      period_start: new RegExp(`^${monthKey}`),
    }).sort({ createdAt: -1 });

    if (existingDaily) {
      existingDaily.employee = emp.name || empDoc?.name || existingDaily.employee;
      existingDaily.total_target = finalDaily;
      existingDaily.period_start = periodStart;
      existingDaily.period_end = periodEnd;
      await existingDaily.save();
    } else if (finalDaily > 0) {
      await EmployeeTask.create({
        employee: emp.name || empDoc?.name || emp.employee_id,
        employee_id: emp.employee_id,
        task_template: `Daily ${roleLabel} Target`,
        period_start: periodStart,
        period_end: periodEnd,
        total_target: finalDaily,
        achieved: 0,
        is_completed: false,
        metric_type: 'Leads Generated',
      });
    }
  }

  if (monthlyTarget !== undefined && !isNaN(Number(monthlyTarget))) {
    const val = Math.max(0, Number(monthlyTarget));
    finalMonthlyCarryover =
      empDoc?.monthly_target_month === monthKey
        ? Math.max(0, Number(empDoc?.monthly_carryover ?? 0))
        : 0;
    finalMonthlyAssigned = val;
    finalMonthly = finalMonthlyCarryover + finalMonthlyAssigned;

    await Employee.updateOne(
      { employee_id: empIdRegex },
      {
        $set: {
          monthly_target_month: monthKey,
          monthly_carryover: finalMonthlyCarryover,
          monthly_assigned: finalMonthlyAssigned,
          monthly_target: finalMonthly,
        },
      }
    );

    const existingMonthly: any = await EmployeeTask.findOne({
      employee_id: empIdRegex,
      task_template: /monthly/i,
      period_start: new RegExp(`^${monthKey}`),
    }).sort({ createdAt: -1 });

    if (existingMonthly) {
      existingMonthly.employee = emp.name || empDoc?.name || existingMonthly.employee;
      existingMonthly.total_target = finalMonthly;
      existingMonthly.period_start = periodStart;
      existingMonthly.period_end = periodEnd;
      await existingMonthly.save();
    } else if (finalMonthly > 0) {
      await EmployeeTask.create({
        employee: emp.name || empDoc?.name || emp.employee_id,
        employee_id: emp.employee_id,
        task_template: `Monthly ${roleLabel} Target`,
        period_start: periodStart,
        period_end: periodEnd,
        total_target: finalMonthly,
        achieved: 0,
        is_completed: false,
        metric_type: 'Leads Generated',
      });
    }
  }

  return {
    daily_target: finalDaily,
    monthly_target: finalMonthly,
    daily_carryover: finalCarryover,
    daily_assigned: finalAssigned,
    monthly_carryover: finalMonthlyCarryover,
    monthly_assigned: finalMonthlyAssigned,
  };
}

export function resolveEmployeeTargets(
  emp: any,
  allEmployeeTasks: any[],
  allLeads?: any[],
  allEmployees?: any[]
): {
  daily_target: number;
  monthly_target: number;
  daily_carryover: number;
  daily_assigned: number;
  monthly_carryover: number;
  monthly_assigned: number;
} {
  const empId = String(emp?.employee_id || '').trim().toLowerCase();
  const empName = String(emp?.name || '').trim().toLowerCase();
  const roleLabel = roleLabelFor(emp?.designation, emp?.employee_id);
  const { monthKey, todayIso } = currentMonthBoundsIst();

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

  let resolvedDaily = 0;
  let resolvedCarryover = Math.max(0, Number(emp?.daily_carryover ?? 0));
  let resolvedAssigned = Math.max(0, Number(emp?.daily_assigned ?? 0));

  if (roleLabel === 'SM') {
    resolvedDaily = 0;
    resolvedCarryover = 0;
    resolvedAssigned = 0;
  } else if (emp?.daily_target_date === todayIso) {
    // Authoritative for today (including 0 when yesterday was completed and nothing assigned today)
    resolvedDaily = Math.max(0, dailyFromEmp);
  } else if (emp?.daily_target_date && emp.daily_target_date < todayIso && Array.isArray(allLeads)) {
    const closedLeads = allLeads.filter(isClosedLeadRecord);
    const completedInPrev = countClosedLeadsBetweenDates(
      emp,
      closedLeads,
      allEmployees || [],
      emp.daily_target_date,
      todayIso
    );
    resolvedCarryover = Math.max(0, dailyFromEmp - completedInPrev);
    resolvedAssigned = 0;
    resolvedDaily = resolvedCarryover;
  } else {
    resolvedDaily =
      dailyFromTask !== undefined && dailyFromTask > 0 ? dailyFromTask : dailyFromEmp;
    resolvedAssigned = resolvedDaily;
  }

  let resolvedMonthly = 0;
  let resolvedMonthlyCarryover = Math.max(0, Number(emp?.monthly_carryover ?? 0));
  let resolvedMonthlyAssigned = Math.max(0, Number(emp?.monthly_assigned ?? 0));

  if (emp?.monthly_target_month === monthKey) {
    resolvedMonthly = Math.max(0, monthlyFromEmp);
  } else if (
    emp?.monthly_target_month &&
    emp.monthly_target_month < monthKey &&
    Array.isArray(allLeads)
  ) {
    const closedLeads = allLeads.filter(isClosedLeadRecord);
    const completedInPrevMonth = countClosedLeadsBetweenDates(
      emp,
      closedLeads,
      allEmployees || [],
      `${emp.monthly_target_month}-01`,
      `${monthKey}-01`
    );
    resolvedMonthlyCarryover = Math.max(0, monthlyFromEmp - completedInPrevMonth);
    resolvedMonthlyAssigned = 0;
    resolvedMonthly = resolvedMonthlyCarryover;
  } else {
    resolvedMonthly =
      monthlyFromTask !== undefined && monthlyFromTask > 0
        ? monthlyFromTask
        : monthlyFromEmp;
    resolvedMonthlyAssigned = resolvedMonthly;
  }

  return {
    daily_target: resolvedDaily,
    monthly_target: resolvedMonthly,
    daily_carryover: resolvedCarryover,
    daily_assigned: resolvedAssigned,
    monthly_carryover: resolvedMonthlyCarryover,
    monthly_assigned: resolvedMonthlyAssigned,
  };
}

/**
 * Recalculates and updates `achieved` and `is_completed` on current-month
 * EmployeeTask documents (SM, ASM, BDE) whenever a lead is closed or tasks are queried.
 */
export async function syncAllEmployeeTaskAchievements(): Promise<void> {
  try {
    await rolloverDailyTargetsIfNeeded();

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
