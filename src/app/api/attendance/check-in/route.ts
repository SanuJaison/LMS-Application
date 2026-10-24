import { connectDB } from '@/lib/db';
import { Attendance } from '@/models/attendence';
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
      return ok(existing, 'Checked in successfully');
    }

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

    return ok(created, 'Checked in successfully', 201);
  } catch (error: any) {
    console.error('POST /api/attendance/check-in error:', error);
    return ok(null, error.message || 'Failed to check in', 500);
  }
}
