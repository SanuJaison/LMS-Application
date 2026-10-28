import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';
import { EmployeeTask } from '@/models/employeeTask';

// 1. GET: Fetch employee tasks from database
export async function GET(req: NextRequest) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;

    await connectDB();
    const search = req.nextUrl.searchParams.get('search');
    const query = search
      ? {
          $or: [
            { employee: { $regex: search, $options: 'i' } },
            { task_template: { $regex: search, $options: 'i' } },
            { period_start: { $regex: search, $options: 'i' } },
            { period_end: { $regex: search, $options: 'i' } },
          ],
        }
      : {};

    const tasks = await EmployeeTask.find(query).sort({ createdAt: 1, _id: 1 });
    return NextResponse.json(tasks, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching employee tasks:', error);
    return NextResponse.json({ message: error.message || 'Failed to fetch employee tasks' }, { status: 500 });
  }
}

// 2. POST: Create employee task in database
export async function POST(req: NextRequest) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;

    await connectDB();
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
        { message: 'Employee and Task Template are required' },
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

    return NextResponse.json(newTask, { status: 201 });
  } catch (error: any) {
    console.error('Error creating employee task:', error);
    return NextResponse.json({ message: error.message || 'Failed to create employee task' }, { status: 500 });
  }
}

// 3. PUT: Update employee task in database
export async function PUT(req: NextRequest) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;

    await connectDB();
    const body = await req.json();
    const id = body.id || body._id;

    if (!id) {
      return NextResponse.json({ message: 'Task ID is required' }, { status: 400 });
    }

    const achieved = Number(body.achieved ?? 0);
    const total_target = Number(body.total_target ?? 15);
    const is_completed = body.is_completed !== undefined ? Boolean(body.is_completed) : achieved >= total_target;

    const updated = await EmployeeTask.findByIdAndUpdate(
      id,
      {
        employee: body.employee?.trim(),
        task_template: body.task_template?.trim(),
        period_start: body.period_start,
        period_end: body.period_end,
        total_target,
        achieved,
        is_completed,
        notes: body.notes,
      },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ message: 'Employee task not found' }, { status: 404 });
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    console.error('Error updating employee task:', error);
    return NextResponse.json({ message: error.message || 'Failed to update employee task' }, { status: 500 });
  }
}

// 4. DELETE: Delete employee task from database
export async function DELETE(req: NextRequest) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;

    await connectDB();
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
      return NextResponse.json({ message: 'Employee tasks deleted successfully' }, { status: 200 });
    }

    if (!id) {
      return NextResponse.json({ message: 'Task ID is required' }, { status: 400 });
    }

    const deleted = await EmployeeTask.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ message: 'Employee task not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Employee task deleted successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting employee task:', error);
    return NextResponse.json({ message: error.message || 'Failed to delete employee task' }, { status: 500 });
  }
}
