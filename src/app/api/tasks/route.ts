import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Task } from '@/models';
import { numericId } from '@/lib/employeeAuth';
import {
  andFilter,
  canAccessEmployee,
  getScope,
  requireAuth,
  scopeFilter,
} from '@/lib/apiAuth';

/**
 * GET /api/tasks
 * Tasks for the caller and, for managers, their team.
 * Requires a Bearer token; no token no longer returns every task.
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const scope = await getScope(auth);

    const { searchParams } = new URL(req.url);
    const assignedTo = (searchParams.get('assigned_to') || '').trim();

    const filters: Record<string, any>[] = [
      scopeFilter(scope, { nameFields: ['assigned_to'] }),
    ];

    if (assignedTo) {
      if (!canAccessEmployee(scope, '', assignedTo)) {
        return NextResponse.json(
          { success: false, message: 'You cannot view this employee\'s tasks.' },
          { status: 403 }
        );
      }
      filters.push({
        assigned_to: new RegExp(`^${escapeRegex(assignedTo)}$`, 'i'),
      });
    }

    const tasks = await Task.find(andFilter(...filters))
      .sort({ createdAt: -1 })
      .lean();

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

function escapeRegex(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
