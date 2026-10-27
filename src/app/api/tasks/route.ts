import { connectDB } from '@/lib/db';
import { EmployeeTask } from '@/models/employeeTask';
import { getEmployee, nameRegex, ok } from '@/lib/employeeAuth';
import { getTeamMembers } from '@/lib/hierarchy';

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
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope');
    const requestedEmployeeId = String(searchParams.get('employee_id') || '').trim();

    let query: any;

    if (scope === 'team' || scope === 'all') {
      // Manager view: tasks belonging to direct reports (or the whole subtree).
      const reports = await getTeamMembers(employee, scope === 'all' ? 'all' : 'direct');
      const employeeIds = reports
        .map((report) => String(report.employee_id || '').trim())
        .filter(Boolean);

      const conditions: any[] = [];
      if (employeeIds.length > 0) conditions.push({ employee_id: { $in: employeeIds } });
      for (const report of reports) {
        const reportName = nameRegex(report.name);
        if (reportName) conditions.push({ employee: reportName });
      }

      query = conditions.length > 0 ? { $or: conditions } : { employee_id: '__none__' };
    } else if (requestedEmployeeId) {
      // Single report lookup, limited to employees inside the caller's subtree.
      const reports = await getTeamMembers(employee, 'all');
      const report = reports.find(
        (item) =>
          String(item.employee_id || '').toLowerCase() === requestedEmployeeId.toLowerCase()
      );

      if (!report) {
        return ok([], 'Not authorized to view this employee');
      }

      const conditions: any[] = [{ employee_id: String(report.employee_id || '') }];
      const reportName = nameRegex(report.name);
      if (reportName) conditions.push({ employee: reportName });
      query = { $or: conditions };
    } else {
      // Default: the signed-in employee's own tasks (unchanged behaviour).
      query = nameFilter
        ? { $or: [{ employee: nameFilter }, { employee_id: employee.employee_id || '__none__' }] }
        : { employee_id: employee.employee_id || '__none__' };
    }

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
