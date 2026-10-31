import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Task, EmployeeTask } from '@/models';
import { Employee } from '@/models/employee';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';
import { numericId } from '@/lib/employeeAuth';

/**
 * GET /api/tasks
 * Returns tasks assigned to the employee or team.
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const token = extractTokenFromHeader(req);
    const decoded = token ? verifyToken(token) : null;

    let employee: any = null;
    if (decoded?.role === 'employee' && decoded.id) {
      employee = await Employee.findById(decoded.id).lean();
    }

    const { searchParams } = new URL(req.url);
    const assignedTo = searchParams.get('assigned_to') || employee?.name;

    const query: Record<string, any> = {};
    if (assignedTo) {
      query.$or = [
        { assigned_to: new RegExp(`^${assignedTo.trim()}$`, 'i') },
        { assigned_to: 'Unassigned' },
      ];
    }

    const tasks = await Task.find(query).sort({ createdAt: -1 }).lean();

    const data = tasks.map((t: any) => ({
      id: numericId(t._id) || t._id.toString(),
      _id: t._id.toString(),
      title: t.title,
      description: t.description || '',
      assigned_to: t.assigned_to,
      priority: t.priority || 'medium',
      status: t.status || 'pending',
      due_date: t.due_date || '',
    }));

    return NextResponse.json({
      success: true,
      data: {
        total: data.length,
        completed: data.filter((t) => t.status === 'completed').length,
        pending: data.filter((t) => t.status !== 'completed').length,
        tasks: data,
        list: data,
      },
    });
  } catch (error: any) {
    console.error('GET /api/tasks error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}
