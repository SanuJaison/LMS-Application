import { connectDB } from '@/lib/db';
import { Attendance } from '@/models/attendence';
import { getEmployee, nameRegex, ok, todayKey } from '@/lib/employeeAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/attendance
 * Today's record plus the employee's recent attendance.
 */
export async function GET(req: Request) {
  try {
    await connectDB();
    const employee = await getEmployee(req);

    if (!employee) {
      return ok({ today: null, records: [] }, 'Unauthenticated');
    }

    const nameFilter = nameRegex(employee.name);
    if (!nameFilter) {
      return ok({ today: null, records: [] }, 'No attendance found');
    }

    const [today, records] = await Promise.all([
      Attendance.findOne({ name: nameFilter, date: todayKey() }).lean(),
      Attendance.find({ name: nameFilter }).sort({ date: -1 }).limit(31).lean(),
    ]);

    return ok({ today, records }, 'Attendance fetched successfully');
  } catch (error: any) {
    console.error('GET /api/attendance error:', error);
    return ok({ today: null, records: [] }, 'Attendance unavailable');
  }
}
