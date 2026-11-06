import { Employee } from '@/models/employee';
import { Leave } from '@/models';
import { SalaryRequest } from '@/models/salaryRequest';

function escapeRegex(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getCurrentSalaryPeriod(date = new Date()): string {
  return date.toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function getMonthDateBounds(date = new Date()): {
  startStr: string;
  endStr: string;
  firstOfMonth: Date;
} {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstOfMonth = new Date(year, month, 1, 0, 0, 0);
  const lastOfMonth = new Date(year, month + 1, 0, 23, 59, 59);
  const pad = (n: number) => String(n).padStart(2, '0');
  const startStr = `${year}-${pad(month + 1)}-01`;
  const endStr = `${year}-${pad(month + 1)}-${pad(lastOfMonth.getDate())}`;
  return { startStr, endStr, firstOfMonth };
}

function countOverlapDays(
  startStr: string,
  endStr: string,
  monthStartStr: string,
  monthEndStr: string
): number {
  const s = startStr > monthStartStr ? startStr : monthStartStr;
  const e = endStr < monthEndStr ? endStr : monthEndStr;
  if (!s || !e || s > e) return 0;
  const startDate = new Date(`${s}T00:00:00`);
  const endDate = new Date(`${e}T00:00:00`);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 1;
  const diff = Math.floor(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  return Math.max(1, diff + 1);
}

/**
 * Automatically credits the fixed ₹5,000 monthly salary on the 1st of every month
 * for all active SM, ASM, and BDE employees (outside Wallet — Wallet is strictly for incentives),
 * and automatically decreases the salary based on leaves taken during the month.
 * Admin can also manually edit any employee's salary or leave deduction.
 */
export async function syncMonthlySalaries(targetPeriod?: string): Promise<void> {
  const now = new Date();
  const period = targetPeriod || getCurrentSalaryPeriod(now);
  const { startStr, endStr, firstOfMonth } = getMonthDateBounds(now);

  // Backfill any active employee whose salary is still 0 to the fixed ₹5,000 base
  await Employee.updateMany(
    {
      status: { $ne: 'inactive' },
      $or: [{ salary: { $exists: false } }, { salary: 0 }, { salary: null }],
    },
    { $set: { salary: 5000 } }
  );

  const employees: any[] = await Employee.find({
    status: { $ne: 'inactive' },
  }).lean();

  if (employees.length === 0) return;

  // Fetch approved leaves in the current month (Attendance only tracks ONLINE/OFFLINE,
  // so leave deductions are driven by approved Leave records).
  const [approvedLeaves, existingRecords] = await Promise.all([
    Leave.find({
      status: 'Approved',
      start_date: { $lte: endStr },
      end_date: { $gte: startStr },
    }).lean(),
    SalaryRequest.find({ period }).lean(),
  ]);
  const absentAttendance: any[] = [];

  const empById = new Map<string, any>();
  for (const e of employees) {
    if (e.employee_id) empById.set(String(e.employee_id).toUpperCase(), e);
  }

  const smEmp = employees.find((e) => {
    const id = String(e.employee_id || '').toUpperCase();
    const des = String(e.designation || '').toLowerCase();
    return (
      id.startsWith('SM') ||
      (des.includes('sales manager') && !des.includes('area'))
    );
  });

  const existingByEmpId = new Map<string, any>();
  for (const r of existingRecords) {
    if (r.employee_id) {
      existingByEmpId.set(String(r.employee_id).toUpperCase(), r);
    }
  }

  for (const emp of employees) {
    const empId = String(emp.employee_id || '').trim();
    const empName = String(emp.name || '').trim();
    if (!empId || !empName) continue;

    // Count approved leave days for this employee in this month
    let leaveDaysFromLeaves = 0;
    for (const lv of approvedLeaves as any[]) {
      const lvEmp = String(lv.employee || '').trim().toLowerCase();
      if (
        lvEmp === empName.toLowerCase() ||
        lvEmp === empId.toLowerCase()
      ) {
        leaveDaysFromLeaves += countOverlapDays(
          String(lv.start_date || ''),
          String(lv.end_date || lv.start_date || ''),
          startStr,
          endStr
        );
      }
    }

    // Count absent/leave days from attendance
    let leaveDaysFromAttendance = 0;
    for (const att of absentAttendance as any[]) {
      const attEmpId = String(att.employee_id || '').trim().toLowerCase();
      const attEmpName = String(att.employee || att.name || '').trim().toLowerCase();
      if (
        (attEmpId && attEmpId === empId.toLowerCase()) ||
        (attEmpName && attEmpName === empName.toLowerCase())
      ) {
        leaveDaysFromAttendance += att.status === 'HALF_DAY' ? 0.5 : 1;
      }
    }

    const computedLeaveDays = Math.min(
      30,
      Math.max(leaveDaysFromLeaves, leaveDaysFromAttendance)
    );

    const existing = existingByEmpId.get(empId.toUpperCase());
    const baseSalary =
      existing?.base_salary && existing.base_salary > 0
        ? Number(existing.base_salary)
        : emp.salary && Number(emp.salary) > 0
          ? Number(emp.salary)
          : 5000;

    if (!existing) {
      const deduction = Math.round((baseSalary / 30) * computedLeaveDays);
      const netAmount = Math.max(0, baseSalary - deduction);
      const reportsToId = String(emp.reports_to || '').toUpperCase();
      const manager = reportsToId ? empById.get(reportsToId) : null;

      const isSm =
        empId.toUpperCase().startsWith('SM') ||
        (String(emp.designation || '').toLowerCase().includes('sales manager') &&
          !String(emp.designation || '').toLowerCase().includes('area'));
      const isAsm =
        empId.toUpperCase().startsWith('ASM') ||
        String(emp.designation || '').toLowerCase().includes('area sales manager');

      const requestId = `SAL-${empId.toUpperCase()}-${now.getFullYear()}${String(
        now.getMonth() + 1
      ).padStart(2, '0')}`;

      await SalaryRequest.findOneAndUpdate(
        { employee_id: empId, period },
        {
          $setOnInsert: {
            request_id: requestId,
            employee_id: empId,
            employee_name: empName,
            designation:
              emp.designation ||
              (isSm
                ? 'Sales Manager'
                : isAsm
                  ? 'Area Sales Manager'
                  : 'Business Development Executive'),
            team: emp.team || (isSm ? 'Statewide' : ''),
            asm_id: isSm ? '' : isAsm ? empId : manager?.employee_id || '',
            asm_name: isSm ? '' : isAsm ? empName : manager?.name || '',
            sm_id: smEmp?.employee_id || '',
            sm_name: smEmp?.name || '',
            base_salary: baseSalary,
            leave_days: computedLeaveDays,
            deduction,
            amount: netAmount,
            manual_override: false,
            period,
            attendance_days: Math.max(0, 30 - computedLeaveDays),
            remarks:
              computedLeaveDays > 0
                ? `Auto-credited ₹${baseSalary} fixed salary on 1st of month (−₹${deduction} for ${computedLeaveDays} leave day(s))`
                : `Auto-credited ₹${baseSalary} fixed monthly salary on 1st of month`,
            status: 'Paid',
            payment_date: firstOfMonth,
            transaction_reference: `AUTO-SAL-${now.getFullYear()}${String(
              now.getMonth() + 1
            ).padStart(2, '0')}-${empId.toUpperCase()}`,
            approval_history: [
              {
                step: 'Auto-Credit (1st of Month)',
                actor: 'System',
                role: 'SYSTEM',
                action: 'Auto-Credited Monthly Salary',
                remarks: `Fixed ₹${baseSalary} monthly salary credited (Leaves: ${computedLeaveDays})`,
                timestamp: firstOfMonth,
              },
            ],
          },
        },
        { upsert: true, new: true }
      );
    } else if (!existing.manual_override) {
      // Automatically recalculate if leaves changed and Admin hasn't locked a manual override,
      // OR if new leaves were taken since last calculation.
      const prevLeaves = Number(existing.leave_days || 0);
      if (computedLeaveDays !== prevLeaves || existing.status !== 'Paid') {
        const deduction = Math.round((baseSalary / 30) * computedLeaveDays);
        const netAmount = Math.max(0, baseSalary - deduction);
        await SalaryRequest.updateOne(
          { _id: existing._id },
          {
            $set: {
              base_salary: baseSalary,
              leave_days: computedLeaveDays,
              deduction,
              amount: netAmount,
              attendance_days: Math.max(0, 30 - computedLeaveDays),
              status: existing.status === 'Rejected' ? 'Rejected' : 'Paid',
              remarks:
                computedLeaveDays > 0
                  ? `Auto-credited ₹${baseSalary} fixed salary on 1st of month (−₹${deduction} for ${computedLeaveDays} leave day(s))`
                  : `Auto-credited ₹${baseSalary} fixed monthly salary on 1st of month`,
            },
          }
        );
      }
    }
  }
}
