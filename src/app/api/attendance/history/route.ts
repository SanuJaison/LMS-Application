import { connectDB } from '@/lib/db';
import { Attendance } from '@/models/attendence';
import { getEmployee, nameRegex, ok } from '@/lib/employeeAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/attendance/history
 * Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=60
 */
export async function GET(req: Request) {
  try {
    await connectDB();
    const employee = await getEmployee(req);

    if (!employee) {
      return ok([], 'Unauthenticated');
    }

    const nameFilter = nameRegex(employee.name);
    if (!nameFilter) {
      return ok([], 'No attendance history found');
    }

    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const limit = Math.min(Number(searchParams.get('limit') || 60), 365);

    const query: any = { name: nameFilter };
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = from;
      if (to) query.date.$lte = to;
    }

    const records = await Attendance.find(query).sort({ date: -1 }).limit(limit).lean();

    return ok(records, 'Attendance history fetched successfully');
  } catch (error: any) {
    console.error('GET /api/attendance/history error:', error);
    return ok([], 'Attendance history unavailable');
  }
}
