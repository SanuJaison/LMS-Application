import { connectDB } from '@/lib/db';
import { Leave } from '@/models';
import { getEmployee, nameRegex, ok } from '@/lib/employeeAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/leaves
 * Leave requests submitted by the signed-in employee.
 */
export async function GET(req: Request) {
  try {
    await connectDB();
    const employee = await getEmployee(req);

    if (!employee) {
      return ok([], 'Unauthenticated');
    }

    const nameFilter = nameRegex(employee.name);
    const query: any = nameFilter ? { employee: nameFilter } : { employee: '__none__' };

    const leaves = await Leave.find(query).sort({ createdAt: -1 }).lean();

    return ok(leaves, 'Leaves fetched successfully');
  } catch (error: any) {
    console.error('GET /api/leaves error:', error);
    return ok([], 'Leaves unavailable');
  }
}
