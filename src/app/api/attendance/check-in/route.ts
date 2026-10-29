import { connectDB } from '@/lib/db';
import { Attendance } from '@/models/attendence';
import { logActivity } from '@/lib/activityLog';
import { formatTime, getEmployee, nameRegex, ok, todayKey } from '@/lib/employeeAuth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/attendance/check-in
 * Creates today's attendance record (or fills in check_in if it was empty).
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

    const existing: any = await Attendance.findOne({ name: nameFilter, date: today });

    if (existing) {
      if (existing.check_in) {
        return ok(existing, 'Already checked in today');
      }
      existing.check_in = now;
      existing.status = 'ONLINE';
      await existing.save();
      await logActivity({
        description: `Checked in at ${now}`,
        subjectType: 'Attendance',
        causer: employee.name,
      });
      return ok(existing, 'Checked in successfully');
    }

    try {
      const created = await Attendance.create({
        name: employee.name,
        designation: employee.designation || 'Field Staff',
        district: employee.district || 'Kerala',
        date: today,
        check_in: now,
        check_out: '',
        hours_worked: 0,
        status: 'ONLINE',
      });

      await logActivity({
        description: `Checked in at ${now}`,
        subjectType: 'Attendance',
        causer: employee.name,
      });

      return ok(created, 'Checked in successfully', 201);
    } catch (error: any) {
      // Two concurrent check-ins can both pass the lookup above. The unique
      // { name, date } index makes the second insert fail with 11000; treat
      // that as "already checked in" instead of creating a duplicate row.
      if (error?.code === 11000) {
        const already: any = await Attendance.findOne({ name: nameFilter, date: today });
        return ok(already, 'Already checked in today');
      }
      throw error;
    }
  } catch (error: any) {
    console.error('POST /api/attendance/check-in error:', error);
    return ok(null, error.message || 'Failed to check in', 500);
  }
}
