import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';
import { EmployeeTask } from '@/models/employeeTask';
import { Employee } from '@/models/employee';
import { authenticate, getScope, requireAuth } from '@/lib/apiAuth';
import { escapeRegex } from '@/lib/employeeAuth';

export const dynamic = 'force-dynamic';

// 1. GET: Fetch employee tasks from database
export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const adminDenied = requireAdmin(req);
    const isAdmin = !adminDenied;

    let auth: any = null;
    if (!isAdmin) {
      const guard = await requireAuth(req);
      if (!guard.ok) return guard.response;
      auth = guard.auth;
    }

    const search = req.nextUrl.searchParams.get('search');
    const employeeParam = req.nextUrl.searchParams.get('employee') || req.nextUrl.searchParams.get('employee_id');

    const filters: Record<string, any>[] = [];

    // Scope filter for non-admins
    if (!isAdmin && auth) {
      if (auth.role === 'BDE') {
        const orConditions: any[] = [];
        if (auth.employeeId) orConditions.push({ employee_id: auth.employeeId });
        if (auth.name) orConditions.push({ employee: new RegExp(`^${escapeRegex(auth.name)}$`, 'i') });
        filters.push({ $or: orConditions });
      } else {
        const scope = await getScope(auth);
        const orConditions: any[] = [];
        if (scope.ids.length > 0) orConditions.push({ employee_id: { $in: scope.ids } });
        if (scope.names.length > 0) {
          orConditions.push(...scope.names.map((n) => ({ employee: new RegExp(`^${escapeRegex(n)}$`, 'i') })));
        }
        if (orConditions.length > 0) {
          filters.push({ $or: orConditions });
        }
      }
    } else if (employeeParam) {
      filters.push({
        $or: [
          { employee_id: employeeParam },
          { employee: new RegExp(`^${escapeRegex(employeeParam)}$`, 'i') },
        ],
      });
    }

    if (search) {
      filters.push({
        $or: [
          { employee: { $regex: search, $options: 'i' } },
          { employee_id: { $regex: search, $options: 'i' } },
          { task_template: { $regex: search, $options: 'i' } },
          { period_start: { $regex: search, $options: 'i' } },
          { period_end: { $regex: search, $options: 'i' } },
        ],
      });
    }

    const query = filters.length > 0 ? (filters.length === 1 ? filters[0] : { $and: filters }) : {};

    const tasks = await EmployeeTask.find(query).sort({ createdAt: -1, _id: -1 }).lean();

    return NextResponse.json(
      {
        success: true,
        count: tasks.length,
        data: tasks,
        tasks,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching employee tasks:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch employee tasks' },
      { status: 500 }
    );
  }
}

// 2. POST: Create employee task in database
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const adminDenied = requireAdmin(req);
    const isAdmin = !adminDenied;

    let auth: any = null;
    if (!isAdmin) {
      const guard = await requireAuth(req);
      if (!guard.ok) return guard.response;
      auth = guard.auth;
      // Only SM, ASM, and Admin can assign performance tasks
      if (auth.role !== 'SM' && auth.role !== 'ASM' && auth.role !== 'BDM') {
        return NextResponse.json(
          { success: false, message: 'Only managers and administrators can assign performance tasks.' },
          { status: 403 }
        );
      }
    }

    const body = await req.json();

    const {
      employee,
      employee_id = '',
      task_template = 'Daily Lead Generation',
      period_start = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      period_end = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      total_target = 15,
      achieved = 0,
      is_completed = false,
      metric_type = 'Leads Generated',
      notes = '',
    } = body;

    if (!employee || !task_template) {
      return NextResponse.json(
        { success: false, message: 'Employee and Task Template are required' },
        { status: 400 }
      );
    }

    const newTask = await EmployeeTask.create({
      employee: employee.trim(),
      employee_id: employee_id.trim(),
      task_template: task_template.trim(),
      period_start,
      period_end,
      total_target: Number(total_target) || 15,
      achieved: Number(achieved) || 0,
      is_completed: Boolean(is_completed),
      metric_type,
      notes,
    });

    if (employee_id.trim()) {
      const isDaily = /daily/i.test(task_template);
      const isMonthly = /monthly/i.test(task_template);
      if (isDaily || isMonthly) {
        await Employee.findOneAndUpdate(
          { employee_id: employee_id.trim() },
          {
            $set: {
              ...(isDaily ? { daily_target: Number(total_target) || 15 } : {}),
              ...(isMonthly ? { monthly_target: Number(total_target) || 15 } : {}),
            },
          }
        );
      }
    }

    return NextResponse.json({ success: true, data: newTask }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating employee task:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create employee task' },
      { status: 500 }
    );
  }
}

// 3. PUT: Update employee task in database
export async function PUT(req: NextRequest) {
  try {
    await connectDB();

    const adminDenied = requireAdmin(req);
    const isAdmin = !adminDenied;

    let auth: any = null;
    if (!isAdmin) {
      const guard = await requireAuth(req);
      if (!guard.ok) return guard.response;
      auth = guard.auth;
    }

    const body = await req.json();
    const id = body.id || body._id;

    if (!id) {
      return NextResponse.json({ success: false, message: 'Task ID is required' }, { status: 400 });
    }

    const existingTask: any = await EmployeeTask.findById(id);
    if (!existingTask) {
      return NextResponse.json({ success: false, message: 'Employee task not found' }, { status: 404 });
    }

    // Permission check for non-admin
    if (!isAdmin && auth) {
      const isOwner =
        (auth.employeeId && existingTask.employee_id === auth.employeeId) ||
        (auth.name && existingTask.employee?.toLowerCase() === auth.name.toLowerCase());

      if (!isOwner) {
        const scope = await getScope(auth);
        const canManage =
          scope.isAll ||
          (existingTask.employee_id && scope.ids.includes(existingTask.employee_id)) ||
          (existingTask.employee && scope.names.map((n: string) => n.toLowerCase()).includes(existingTask.employee.toLowerCase()));

        if (!canManage) {
          return NextResponse.json(
            { success: false, message: 'You do not have permission to update this task' },
            { status: 403 }
          );
        }
      }
    }

    const achieved = body.achieved !== undefined ? Number(body.achieved) : existingTask.achieved;
    const total_target = body.total_target !== undefined ? Number(body.total_target) : existingTask.total_target;
    const is_completed = body.is_completed !== undefined ? Boolean(body.is_completed) : achieved >= total_target;

    const updateFields: any = {
      achieved,
      total_target,
      is_completed,
    };
    if (body.notes !== undefined) updateFields.notes = body.notes;
    if (isAdmin) {
      if (body.employee) updateFields.employee = body.employee.trim();
      if (body.task_template) updateFields.task_template = body.task_template.trim();
      if (body.period_start) updateFields.period_start = body.period_start;
      if (body.period_end) updateFields.period_end = body.period_end;
    }

    const updated = await EmployeeTask.findByIdAndUpdate(id, updateFields, { new: true });

    if (existingTask.employee_id && total_target !== undefined) {
      const isDaily = /daily/i.test(existingTask.task_template || '');
      const isMonthly = /monthly/i.test(existingTask.task_template || '');
      if (isDaily || isMonthly) {
        await Employee.findOneAndUpdate(
          { employee_id: existingTask.employee_id },
          {
            $set: {
              ...(isDaily ? { daily_target: total_target } : {}),
              ...(isMonthly ? { monthly_target: total_target } : {}),
            },
          }
        );
      }
    }

    return NextResponse.json({ success: true, data: updated }, { status: 200 });
  } catch (error: any) {
    console.error('Error updating employee task:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update employee task' },
      { status: 500 }
    );
  }
}

// 4. DELETE: Delete employee task from database
export async function DELETE(req: NextRequest) {
  try {
    await connectDB();

    const adminDenied = requireAdmin(req);
    const isAdmin = !adminDenied;

    if (!isAdmin) {
      const guard = await requireAuth(req);
      if (!guard.ok) return guard.response;
      if (guard.auth.role !== 'SM' && guard.auth.role !== 'ASM' && guard.auth.role !== 'BDM') {
        return NextResponse.json(
          { success: false, message: 'Only managers and administrators can delete performance tasks.' },
          { status: 403 }
        );
      }
    }

    const searchParams = req.nextUrl.searchParams;
    let id = searchParams.get('id');
    let ids: string[] = [];

    try {
      const body = await req.json();
      if (body) {
        id = id || body.id || body._id;
        if (Array.isArray(body.ids)) {
          ids = body.ids;
        }
      }
    } catch {
      // ignore
    }

    if (ids.length > 0) {
      await EmployeeTask.deleteMany({ _id: { $in: ids } });
      return NextResponse.json({ success: true, message: 'Employee tasks deleted successfully' }, { status: 200 });
    }

    if (!id) {
      return NextResponse.json({ success: false, message: 'Task ID is required' }, { status: 400 });
    }

    const deleted = await EmployeeTask.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ success: false, message: 'Employee task not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Employee task deleted successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting employee task:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to delete employee task' },
      { status: 500 }
    );
  }
}
