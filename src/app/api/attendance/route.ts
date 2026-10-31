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
