import { connectDB } from '@/lib/db';
import { Leave } from '@/models';
import { getEmployee, ok } from '@/lib/employeeAuth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/leaves/apply
 * Body: { leave_type, start_date, end_date, reason }
 */
export async function POST(req: Request) {
  try {
    await connectDB();
    const employee = await getEmployee(req);

    if (!employee) {
      return ok(null, 'Unauthenticated', 401);
    }

    const body = await req.json().catch(() => ({}));

    const startDate = String(body.start_date || body.from_date || '').trim();
    const endDate = String(body.end_date || body.to_date || startDate).trim();

    if (!startDate || !endDate) {
      return ok(null, 'Start date and end date are required', 400);
    }

    const leave = await Leave.create({
      employee: employee.name,
      leave_type: String(body.leave_type || body.type || 'Casual Leave').trim(),
      start_date: startDate,
      end_date: endDate,
      reason: String(body.reason || body.remarks || '').trim(),
      status: 'Pending',
    });

    return ok(leave, 'Leave applied successfully', 201);
  } catch (error: any) {
    console.error('POST /api/leaves/apply error:', error);
    return ok(null, error.message || 'Failed to apply leave', 500);
  }
}
