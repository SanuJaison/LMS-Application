import { connectDB } from '@/lib/db';
import { EmployeeTask } from '@/models/employeeTask';
import { getEmployee, nameRegex, ok } from '@/lib/employeeAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tasks
 * Performance tasks assigned to the signed-in employee.
 */
export async function GET(req: Request) {
  try {
    await connectDB();
    const employee = await getEmployee(req);

    if (!employee) {
      return ok([], 'Unauthenticated');
    }

    const nameFilter = nameRegex(employee.name);
    const query: any = nameFilter
      ? { $or: [{ employee: nameFilter }, { employee_id: employee.employee_id || '__none__' }] }
      : { employee_id: employee.employee_id || '__none__' };

    const tasks = await EmployeeTask.find(query).sort({ createdAt: -1 }).lean();

    return ok(tasks, 'Tasks fetched successfully');
  } catch (error: any) {
    console.error('GET /api/tasks error:', error);
    return ok([], 'Tasks unavailable');
  }
}

/**
 * PUT /api/tasks
 * Update progress on a task: { "id": "...", "achieved": 5, "is_completed": false }
 */
export async function PUT(req: Request) {
  try {
    await connectDB();
    const employee = await getEmployee(req);

    if (!employee) {
      return ok(null, 'Unauthenticated');
    }

    const body = await req.json().catch(() => ({}));
    const id = body.id || body._id;

    if (!id) {
      return ok(null, 'Task id is required', 400);
    }

    const update: any = {};
    if (body.achieved !== undefined) update.achieved = Number(body.achieved);
    if (body.is_completed !== undefined) update.is_completed = Boolean(body.is_completed);
    if (body.notes !== undefined) update.notes = String(body.notes);

    const updated = await EmployeeTask.findByIdAndUpdate(id, update, { new: true });

    if (!updated) {
      return ok(null, 'Task not found', 404);
    }

    return ok(updated, 'Task updated successfully');
  } catch (error: any) {
    console.error('PUT /api/tasks error:', error);
    return ok(null, error.message || 'Failed to update task', 500);
  }
}
