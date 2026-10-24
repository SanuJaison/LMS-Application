import { connectDB } from '@/lib/db';
import { Attendance } from '@/models/attendence';
import { EmployeeTask } from '@/models/employeeTask';
import { Leave, Wallet } from '@/models';
import { Lead } from '@/models/lead';
import {
  getEmployee,
  nameRegex,
  ok,
  serializeEmployee,
  todayKey,
} from '@/lib/employeeAuth';

export const dynamic = 'force-dynamic';

function emptyHome() {
  return {
    employee: null,
    attendance: {
      date: todayKey(),
      status: 'OFFLINE',
      check_in: null,
      check_out: null,
      hours_worked: 0,
      checked_in: false,
      checked_out: false,
    },
    tasks: { total: 0, completed: 0, pending: 0, list: [] },
    leaves: { total: 0, pending: 0, approved: 0, rejected: 0, list: [] },
    wallet: { balance: 0, currency: 'INR' },
    leads: { total: 0, today: 0, admitted: 0 },
  };
}

/**
 * GET /api/home
 * Dashboard summary for the signed-in employee.
 */
export async function GET(req: Request) {
  try {
    await connectDB();
    const employee = await getEmployee(req);

    // Called before login on the splash screen - return an empty shell instead of 401
    // so the auth interceptor does not force a logout.
    if (!employee) {
      return ok(emptyHome(), 'Unauthenticated');
    }

    const nameFilter = nameRegex(employee.name);
    const today = todayKey();
    const startOfToday = new Date(`${today}T00:00:00.000Z`);

    const taskQuery: any = nameFilter
      ? { $or: [{ employee: nameFilter }, { employee_id: employee.employee_id || '__none__' }] }
      : { employee_id: employee.employee_id || '__none__' };

    const leaveQuery: any = nameFilter ? { employee: nameFilter } : { employee: '__none__' };
    const leadQuery: any = (() => {
      const mine: any[] = [];
      if (nameFilter) mine.push({ employee: nameFilter });
      if (employee.employee_id) mine.push({ employee_id: employee.employee_id });
      return mine.length ? { $or: mine } : { employee: '__none__' };
    })();
    const walletQuery: any = nameFilter ? { employee: nameFilter } : { employee: '__none__' };

    const [attendance, tasks, leaves, wallet, leads] = await Promise.all([
      Attendance.findOne({ ...(nameFilter ? { name: nameFilter } : { name: '__none__' }), date: today }).lean(),
      EmployeeTask.find(taskQuery).sort({ createdAt: -1 }).limit(10).lean(),
      Leave.find(leaveQuery).sort({ createdAt: -1 }).lean(),
      Wallet.findOne(walletQuery).lean(),
      Lead.find(leadQuery).lean(),
    ]);

    const taskList = tasks as any[];
    const leaveList = leaves as any[];
    const leadList = leads as any[];

    return ok(
      {
        employee: serializeEmployee(employee),
        attendance: {
          date: today,
          status: attendance?.status || 'OFFLINE',
          check_in: attendance?.check_in || null,
          check_out: attendance?.check_out || null,
          hours_worked: attendance?.hours_worked || 0,
          checked_in: Boolean(attendance?.check_in),
          checked_out: Boolean(attendance?.check_out),
        },
        tasks: {
          total: taskList.length,
          completed: taskList.filter((t) => t.is_completed).length,
          pending: taskList.filter((t) => !t.is_completed).length,
          list: taskList,
        },
        leaves: {
          total: leaveList.length,
          pending: leaveList.filter((l) => l.status === 'Pending').length,
          approved: leaveList.filter((l) => l.status === 'Approved').length,
          rejected: leaveList.filter((l) => l.status === 'Rejected').length,
          list: leaveList.slice(0, 5),
        },
        wallet: {
          balance: (wallet as any)?.balance || 0,
          currency: (wallet as any)?.currency || 'INR',
        },
        leads: {
          total: leadList.length,
          today: leadList.filter((l) => new Date(l.createdAt) >= startOfToday).length,
          admitted: leadList.filter(
            (l) => l.admission_status === 'Admitted' || l.status === 'Won'
          ).length,
        },
      },
      'Home data fetched successfully'
    );
  } catch (error: any) {
    console.error('GET /api/home error:', error);
    // Never break the mobile dashboard on a data error
    return ok(emptyHome(), 'Home data unavailable');
  }
}
