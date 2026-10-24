import { connectDB } from '@/lib/db';
import { Attendance } from '@/models/attendence';
import { getEmployee, nameRegex, ok, todayKey } from '@/lib/employeeAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/attendance/status
 * Whether the employee has checked in / out today.
 */
export async function GET(req: Request) {
  try {
    await connectDB();
    const employee = await getEmployee(req);

    const base = {
      date: todayKey(),
      status: 'OFFLINE',
      check_in: null as string | null,
      check_out: null as string | null,
      hours_worked: 0,
      checked_in: false,
      checked_out: false,
    };

    if (!employee) {
      return ok(base, 'Unauthenticated');
    }

    const nameFilter = nameRegex(employee.name);
    if (!nameFilter) {
      return ok(base, 'No attendance found');
    }

    const record: any = await Attendance.findOne({
      name: nameFilter,
      date: todayKey(),
    }).lean();

    if (!record) {
      return ok(base, 'Not checked in');
    }

    return ok(
      {
        id: record._id?.toString(),
        date: record.date,
        status: record.status || 'OFFLINE',
        check_in: record.check_in || null,
        check_out: record.check_out || null,
        hours_worked: record.hours_worked || 0,
        checked_in: Boolean(record.check_in),
        checked_out: Boolean(record.check_out),
      },
      'Attendance status fetched successfully'
    );
  } catch (error: any) {
    console.error('GET /api/attendance/status error:', error);
    return ok(
      {
        date: todayKey(),
        status: 'OFFLINE',
        check_in: null,
        check_out: null,
        hours_worked: 0,
        checked_in: false,
        checked_out: false,
      },
      'Attendance status unavailable'
    );
  }
}
