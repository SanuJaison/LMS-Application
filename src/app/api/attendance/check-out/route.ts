import { connectDB } from '@/lib/db';
import { Attendance } from '@/models/attendence';
import {
  formatTime,
  getEmployee,
  nameRegex,
  ok,
  parseTimeToMinutes,
  todayKey,
} from '@/lib/employeeAuth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/attendance/check-out
 * Sets check_out and computes hours_worked for today's record.
 */
export async function POST(req: Request) {
  try {
    await connectDB();
    const employee = await getEmployee(req);

    if (!employee) {
      return ok(null, 'Unauthenticated', 401);
    }

    const nameFilter = nameRegex(employee.name);
    if (!nameFilter) {
      return ok(null, 'Employee name is missing', 400);
    }

    const today = todayKey();
    const now = formatTime();

    const record: any = await Attendance.findOne({ name: nameFilter, date: today });

    if (!record) {
      return ok(null, 'You have not checked in today', 400);
    }

    if (record.check_out) {
      return ok(record, 'Already checked out today');
    }

    record.check_out = now;
    record.status = 'OFFLINE';

    const start = parseTimeToMinutes(record.check_in);
    const end = parseTimeToMinutes(now);
    if (start !== null && end !== null && end > start) {
      record.hours_worked = Math.round(((end - start) / 60) * 100) / 100;
    }

    await record.save();

    return ok(record, 'Checked out successfully');
  } catch (error: any) {
    console.error('POST /api/attendance/check-out error:', error);
    return ok(null, error.message || 'Failed to check out', 500);
  }
}
