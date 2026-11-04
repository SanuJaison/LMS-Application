import { connectDB } from '@/lib/db';
import { Attendance } from '@/models/attendence';
import { nameRegex, ok, todayKey } from '@/lib/employeeAuth';
import { requireEmployee } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/attendance
 * Today's record plus the employee's recent attendance. Own records only.
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireEmployee(req);
    if (!guard.ok) return guard.response;

    const employee = guard.auth.employee;
    const employeeId = guard.auth.employeeId;
    const nameFilter = nameRegex(employee.name);

    const queryFilter: Record<string, any> = {
      $or: [
        ...(employeeId ? [{ employee_id: employeeId }] : []),
        ...(nameFilter ? [{ name: nameFilter }] : []),
      ],
    };

    if (queryFilter.$or.length === 0) {
      return ok({ today: null, records: [] }, 'No attendance found');
    }

    const todayFilter = {
      ...queryFilter,
      date: todayKey(),
    };

    const [rawToday, rawRecords] = await Promise.all([
      Attendance.findOne(todayFilter).lean() as Promise<any>,
      Attendance.find(queryFilter).sort({ date: -1 }).limit(31).lean() as Promise<any[]>,
    ]);

    let today = rawToday;
    if (today && today.status === 'ONLINE') {
      today = { ...today, check_out: '' };
    }

    return ok({ today, records: rawRecords || [] }, 'Attendance fetched successfully');
  } catch (error: any) {
    console.error('GET /api/attendance error:', error);
    return ok({ today: null, records: [] }, 'Attendance unavailable');
  }
}
