import { connectDB } from '@/lib/db';
import { Attendance } from '@/models/attendence';
import { EmployeeTask } from '@/models/employeeTask';
import { Leave, Wallet } from '@/models';
import { getEmployee, nameRegex, ok, todayKey } from '@/lib/employeeAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/operations
 * Combined data for the Operations tab: leaves, wallet, attendance and tasks.
 */
export async function GET(req: Request) {
  try {
    await connectDB();
    const employee = await getEmployee(req);

    const empty = {
      leaves: [],
      wallet: { balance: 0, currency: 'INR' },
      attendance: { today: null, records: [] },
      tasks: [],
      summary: {
        leaves_pending: 0,
        leaves_approved: 0,
        tasks_pending: 0,
        tasks_completed: 0,
      },
    };

    if (!employee) {
      return ok(empty, 'Unauthenticated');
    }

    const nameFilter = nameRegex(employee.name);
    if (!nameFilter) {
      return ok(empty, 'No operations data found');
    }

    const [leaves, wallet, todayRecord, records, tasks] = await Promise.all([
      Leave.find({ employee: nameFilter }).sort({ createdAt: -1 }).lean(),
      Wallet.findOne({ employee: nameFilter }).lean(),
      Attendance.findOne({ name: nameFilter, date: todayKey() }).lean(),
      Attendance.find({ name: nameFilter }).sort({ date: -1 }).limit(31).lean(),
      EmployeeTask.find({ employee: nameFilter }).sort({ createdAt: -1 }).lean(),
    ]);

    const leaveList = leaves as any[];
    const taskList = tasks as any[];

    return ok(
      {
        leaves: leaveList,
        wallet: {
          balance: (wallet as any)?.balance || 0,
          currency: (wallet as any)?.currency || 'INR',
        },
        attendance: { today: todayRecord, records },
        tasks: taskList,
        summary: {
          leaves_pending: leaveList.filter((l) => l.status === 'Pending').length,
          leaves_approved: leaveList.filter((l) => l.status === 'Approved').length,
          tasks_pending: taskList.filter((t) => !t.is_completed).length,
          tasks_completed: taskList.filter((t) => t.is_completed).length,
        },
      },
      'Operations data fetched successfully'
    );
  } catch (error: any) {
    console.error('GET /api/operations error:', error);
    return ok(
      {
        leaves: [],
        wallet: { balance: 0, currency: 'INR' },
        attendance: { today: null, records: [] },
        tasks: [],
        summary: {
          leaves_pending: 0,
          leaves_approved: 0,
          tasks_pending: 0,
          tasks_completed: 0,
        },
      },
      'Operations data unavailable'
    );
  }
}
