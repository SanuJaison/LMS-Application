import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Task, Team } from '@/models';
import { Employee } from '@/models/employee';
import { numericId } from '@/lib/employeeAuth';
import { logActivity, causerFromRequest } from '@/lib/activityLog';
import { parseTargetInput, syncEmployeeTargets } from '@/lib/targetSync';
import {
  andFilter,
  canAccessEmployee,
  forbidden,
  getScope,
  requireAuth,
  requireRoles,
  scopeFilter,
  type Scope,
} from '@/lib/apiAuth';

/**
 * Task assignment (master workflow §5.3 / §6.2):
 *
 *   SM  -> assigns tasks to the 8 teams (7 regional ASMs + Office Team)
 *   ASM -> assigns tasks to the BDEs that report to them
 *   BDE -> sees only tasks assigned to them and may update their own status
 *   Admin -> read-only visibility over every task
 *
 * GET    /api/tasks
 * POST   /api/tasks   (SM / ASM / BDM only)
 * PUT    /api/tasks   (creator, assignee, manager in scope or admin)
 * DELETE /api/tasks   (creator, manager in scope or admin)
 */

interface ResolvedAssignee {
  name: string;
  employeeId: string;
  team: string;
}

function escapeRegex(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseTeamLead(teamLead: string): { name: string; employeeId: string } {
  const raw = String(teamLead || '').trim();
  const match = raw.match(/^(.*?)\s*\((.*?)\)\s*$/);
  if (match) {
    return { name: match[1].trim(), employeeId: match[2].trim() };
  }
  return { name: raw, employeeId: '' };
}

async function findEmployee(idOrName: string): Promise<any | null> {
  const value = String(idOrName || '').trim();
  if (!value) return null;

  const byId: any = await Employee.findOne({
    employee_id: new RegExp(`^${escapeRegex(value)}$`, 'i'),
  }).lean();
  if (byId) return byId;

  return Employee.findOne({
    name: new RegExp(`^${escapeRegex(value)}$`, 'i'),
  }).lean();
}

async function findTeam(input: string): Promise<any | null> {
  const raw = String(input || '').trim();
  if (!raw) return null;

  // Exact match first (e.g. "EKM Team", "Office Team")
  let team: any = await Team.findOne({
    name: new RegExp(`^${escapeRegex(raw)}$`, 'i'),
  }).lean();
  if (team) return team;

  // Prefix word match (e.g. "EKM" matches "EKM Team")
  team = await Team.findOne({
    name: new RegExp(`^${escapeRegex(raw)}\\b`, 'i'),
  }).lean();
  if (team) return team;

  // 3-letter regional code (e.g. "EKM", "TVM", "KZD", "KZE")
  const codeMatch = raw.toUpperCase().match(/^([A-Z]{3})/);
  if (codeMatch) {
    let code = codeMatch[1];
    if (code === 'KZE') code = 'KZD';
    team = await Team.findOne({
      name: new RegExp(`^${code}`, 'i'),
    }).lean();
    if (team) return team;
  }

  return null;
}

async function findTeamLeadEmployee(team: any): Promise<any | null> {
  if (!team) return null;
  const lead = parseTeamLead(team.team_lead || '');
  let leadEmployee: any = null;

  if (lead.employeeId) {
    leadEmployee = await Employee.findOne({
      employee_id: new RegExp(`^${escapeRegex(lead.employeeId)}$`, 'i'),
    }).lean();
  }
  if (!leadEmployee && lead.name) {
    leadEmployee = await findEmployee(lead.name);
  }
  // Fallback: look for the active ASM assigned to this team
  if (!leadEmployee) {
    leadEmployee = await Employee.findOne({
      team: new RegExp(`^${escapeRegex(team.name)}$`, 'i'),
      $or: [
        { designation: /area sales manager/i },
        { designation: /office team lead/i },
        { employee_id: /^ASM/i },
      ],
      status: 'active',
    }).lean();
  }
  // Fallback for Office Team:
  if (!leadEmployee && team.is_office) {
    leadEmployee = await Employee.findOne({
      $or: [
        { team: /office team/i },
        { designation: /office team lead/i },
      ],
      status: 'active',
    }).lean();
  }
  return leadEmployee;
}

/**
 * Resolve the requested assignee and enforce the caller's assignment rights.
 * Returns `{ error }` on failure.
 */
async function resolveAssignee(
  auth: any,
  scope: Scope,
  body: any
): Promise<{ value?: ResolvedAssignee; error?: { message: string; status: number } }> {
  const requestedTeam = String(body.team || '').trim();
  const requestedAssignee = String(
    body.assigned_to || body.assigned_to_id || body.employee_id || ''
  ).trim();

  // 1) Team assignment: SM only, and the team lead becomes the assignee.
  if (requestedTeam && !requestedAssignee) {
    if (auth.role !== 'SM' && !auth.isAdmin) {
      return {
        error: {
          message: 'Only the Sales Manager can assign a task to a team.',
          status: 403,
        },
      };
    }

    const team: any = await findTeam(requestedTeam);
    if (!team) {
      return {
        error: { message: `Team "${requestedTeam}" not found.`, status: 400 },
      };
    }

    const leadEmployee = await findTeamLeadEmployee(team);

    if (!leadEmployee) {
      return {
        error: {
          message: `Team "${team.name}" has no assigned lead to receive the task.`,
          status: 400,
        },
      };
    }

    return {
      value: {
        name: leadEmployee.name,
        employeeId: String(leadEmployee.employee_id || ''),
        team: team.name,
      },
    };
  }

  if (!requestedAssignee) {
    return {
      error: {
        message:
          'Validation failed: assigned_to (employee name, employee_id or team) is required.',
        status: 400,
      },
    };
  }

  // 2) Employee assignment. Accept an employee_id, an employee name, or a
  //    team code/name (e.g. "EKM" or "EKM Team") for SM/Admin.
  let employee: any = await findEmployee(requestedAssignee);
  let teamName = '';

  if (!employee && (auth.role === 'SM' || auth.isAdmin)) {
    const team: any = await findTeam(requestedAssignee);
    if (team) {
      employee = await findTeamLeadEmployee(team);
      teamName = team.name;
    }
  }

  if (!employee) {
    return {
      error: {
        message: `Employee or team "${requestedAssignee}" was not found.`,
        status: 404,
      },
    };
  }

  const employeeId = String(employee.employee_id || '');
  const employeeName = String(employee.name || '');

  // 3) Downward-only assignment rights.
  if (auth.role === 'ASM' || auth.role === 'BDM') {
    const isSelf = employeeId === auth.employeeId;
    const isDirectReport =
      String(employee.reports_to || '').trim().toLowerCase() ===
      String(auth.employeeId || '').trim().toLowerCase();

    if (!isSelf && !isDirectReport) {
      return {
        error: {
          message:
            'An Area Sales Manager can assign tasks only to the BDEs that report to them.',
          status: 403,
        },
      };
    }
  } else if (auth.role === 'SM') {
    if (!canAccessEmployee(scope, employeeId, employeeName)) {
      return {
        error: {
          message: 'That employee is outside your hierarchy.',
          status: 403,
        },
      };
    }
  }

  return {
    value: {
      name: employeeName,
      employeeId,
      team: teamName || String(employee.team || ''),
    },
  };
}

function serializeTask(t: any) {
  return {
    id: numericId(t._id) || t._id.toString(),
    _id: t._id.toString(),
    title: t.title,
    description: t.description || '',
    assigned_to: t.assigned_to,
    assigned_to_id: t.assigned_to_id || '',
    assigned_by: t.assigned_by || '',
    assigned_by_id: t.assigned_by_id || '',
    assigned_by_role: t.assigned_by_role || '',
    team: t.team || '',
    priority: t.priority || 'medium',
    status: t.status || 'pending',
    due_date: t.due_date || '',
    target_count: t.target_count || 0,
    completed_count: t.completed_count || 0,
    notes: t.notes || '',
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  };
}

// --------------------------------------------------------------------- GET
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const scope = await getScope(auth);
    const { searchParams } = new URL(req.url);

    const assignedTo = (searchParams.get('assigned_to') || '').trim();
    const status = (searchParams.get('status') || '').trim();
    const team = (searchParams.get('team') || '').trim();
    const mine = ['1', 'true', 'yes'].includes(
      (searchParams.get('mine') || '').toLowerCase()
    );

    const filters: Record<string, any>[] = [];

    if (!scope.isAll) {
      // Visible tasks: assigned inside the caller's subtree, or created by the
      // caller. A BDE only ever sees tasks assigned to them.
      const visible = scopeFilter(scope, {
        idFields: ['assigned_to_id'],
        nameFields: ['assigned_to'],
      });
      filters.push({
        $or: [
          visible,
          { assigned_by_id: auth.employeeId },
          { assigned_by: new RegExp(`^${escapeRegex(auth.name)}$`, 'i') },
        ],
      });
    }

    if (mine && auth.employeeId) {
      filters.push({
        $or: [
          { assigned_to_id: auth.employeeId },
          { assigned_to: new RegExp(`^${escapeRegex(auth.name)}$`, 'i') },
        ],
      });
    }

    if (assignedTo) {
      if (!canAccessEmployee(scope, assignedTo, assignedTo)) {
        // A manager may still ask for a task they created for that person.
        const target = await findEmployee(assignedTo);
        if (!target || !canAccessEmployee(scope, target.employee_id, target.name)) {
          return forbidden("You cannot view this employee's tasks.");
        }
      }
      filters.push({
        $or: [
          { assigned_to_id: assignedTo },
          { assigned_to: new RegExp(`^${escapeRegex(assignedTo)}$`, 'i') },
        ],
      });
    }

    if (status) filters.push({ status });

    if (team) {
      filters.push({ team: new RegExp(`^${escapeRegex(team)}$`, 'i') });
    }

    const tasks = await Task.find(andFilter(...filters))
      .sort({ createdAt: -1 })
      .lean();

    const data = tasks.map(serializeTask);

    return NextResponse.json({
      success: true,
      count: data.length,
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

// -------------------------------------------------------------------- POST
export async function POST(req: Request) {
  try {
    await connectDB();

    // Admin no longer assigns tasks: SM -> teams, ASM -> BDEs.
    const guard = await requireRoles(req, ['SM', 'ASM', 'BDM']);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const scope = await getScope(auth);
    const body = await req.json().catch(() => ({}));

    const title = String(body.title || '').trim();
    if (!title) {
      return NextResponse.json(
        { success: false, message: 'Validation failed: Task title is required.' },
        { status: 400 }
      );
    }

    const resolved = await resolveAssignee(auth, scope, body);
    if (resolved.error) {
      return NextResponse.json(
        { success: false, message: resolved.error.message },
        { status: resolved.error.status }
      );
    }
    const assignee = resolved.value!;

    const priority = ['low', 'medium', 'high'].includes(
      String(body.priority || '').toLowerCase()
    )
      ? String(body.priority).toLowerCase()
      : 'medium';

    const task = await Task.create({
      title,
      description: String(body.description || '').trim(),
      assigned_to: assignee.name,
      assigned_to_id: assignee.employeeId,
      assigned_by: auth.name,
      assigned_by_id: auth.employeeId,
      assigned_by_role: auth.role,
      team: String(body.team || assignee.team || '').trim(),
      priority,
      status: 'pending',
      due_date: String(body.due_date || '').trim(),
      target_count: Number(body.target_count || 0) || 0,
      completed_count: 0,
      notes: String(body.notes || '').trim(),
    });

    await logActivity({
      description: `Task "${task.title}" assigned to ${assignee.name} (${assignee.employeeId}) by ${auth.name}`,
      subjectType: 'Task',
      causer: causerFromRequest(req),
    });

    // Also sync daily / monthly target if passed in body or inferred from task title
    const targetInput = parseTargetInput(body);
    let syncDaily = targetInput.hasDaily ? targetInput.dailyTarget : undefined;
    let syncMonthly = targetInput.hasMonthly ? targetInput.monthlyTarget : undefined;
    const targetCountNum = Number(body.target_count || 0) || 0;
    if (targetCountNum > 0) {
      if (syncDaily === undefined && /daily/i.test(title)) {
        syncDaily = targetCountNum;
      }
      if (syncMonthly === undefined && /monthly/i.test(title)) {
        syncMonthly = targetCountNum;
      }
    }
    if ((syncDaily !== undefined || syncMonthly !== undefined) && assignee.employeeId) {
      const synced = await syncEmployeeTargets(
        {
          employee_id: assignee.employeeId,
          name: assignee.name,
        },
        syncDaily,
        syncMonthly
      );
      if (syncDaily !== undefined && /daily/i.test(title)) {
        task.target_count = synced.daily_target;
        await task.save();
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `Task assigned to ${assignee.name}.`,
        data: serializeTask(task),
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('POST /api/tasks error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create task' },
      { status: 500 }
    );
  }
}

// --------------------------------------------------------------------- PUT
export async function PUT(req: Request) {
  return updateTask(req);
}

export async function PATCH(req: Request) {
  return updateTask(req);
}

async function updateTask(req: Request) {
  try {
    await connectDB();

    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const scope = await getScope(auth);
    const body = await req.json().catch(() => ({}));

    const id = String(body.id || body._id || '').trim();
    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Validation failed: Task id is required.' },
        { status: 400 }
      );
    }

    const task: any = await Task.findById(id);
    if (!task) {
      return NextResponse.json(
        { success: false, message: 'Task not found.' },
        { status: 404 }
      );
    }

    const isCreator =
      Boolean(auth.employeeId) &&
      String(task.assigned_by_id || '') === String(auth.employeeId);
    const isAssignee =
      (Boolean(auth.employeeId) &&
        String(task.assigned_to_id || '') === String(auth.employeeId)) ||
      String(task.assigned_to || '').trim().toLowerCase() ===
        String(auth.name || '').trim().toLowerCase();
    const isManager = ['SM', 'ASM', 'BDM', 'MD'].includes(auth.role);
    const isManagerInScope =
      isManager &&
      canAccessEmployee(scope, task.assigned_to_id, task.assigned_to);

    const canManage = auth.isAdmin || isCreator || isManagerInScope;

    if (!auth.isAdmin && !canManage && !isAssignee) {
      return forbidden('You cannot update this task.');
    }

    // Assignee-only edits are limited to progress/status fields.
    if (!auth.isAdmin && !canManage && isAssignee) {
      const allowedKeys = ['id', '_id', 'status', 'completed_count', 'notes'];
      const extra = Object.keys(body).filter((k) => !allowedKeys.includes(k));
      if (extra.length > 0) {
        return forbidden(
          `As the assignee you may only update: status, completed_count, notes. Unexpected: ${extra.join(', ')}.`
        );
      }
    }

    // Reassignment is manager/creator only, and stays inside the hierarchy.
    if (body.assigned_to || body.assigned_to_id || body.team) {
      if (!auth.isAdmin && !canManage) {
        return forbidden('Only the task creator or a manager can reassign a task.');
      }
      const resolved = await resolveAssignee(auth, scope, {
        ...body,
        // keep the current assignee unless the caller asked to change it
        assigned_to: body.assigned_to || body.assigned_to_id,
        team: body.team,
      });
      if (resolved.error) {
        return NextResponse.json(
          { success: false, message: resolved.error.message },
          { status: resolved.error.status }
        );
      }
      const assignee = resolved.value!;
      task.assigned_to = assignee.name;
      task.assigned_to_id = assignee.employeeId;
      if (assignee.team) task.team = assignee.team;
    }

    if (body.title !== undefined) task.title = String(body.title).trim();
    if (body.description !== undefined)
      task.description = String(body.description || '').trim();
    if (body.priority !== undefined) {
      const priority = String(body.priority || '').toLowerCase();
      if (!['low', 'medium', 'high'].includes(priority)) {
        return NextResponse.json(
          {
            success: false,
            message: 'priority must be one of: low, medium, high.',
          },
          { status: 400 }
        );
      }
      task.priority = priority;
    }
    if (body.status !== undefined) {
      const status = String(body.status || '').toLowerCase();
      if (!['pending', 'in_progress', 'completed'].includes(status)) {
        return NextResponse.json(
          {
            success: false,
            message: 'status must be one of: pending, in_progress, completed.',
          },
          { status: 400 }
        );
      }
      task.status = status;
    }
    if (body.due_date !== undefined) task.due_date = String(body.due_date || '').trim();
    if (body.target_count !== undefined)
      task.target_count = Number(body.target_count || 0) || 0;
    if (body.completed_count !== undefined)
      task.completed_count = Number(body.completed_count || 0) || 0;
    if (body.notes !== undefined) task.notes = String(body.notes || '').trim();

    await task.save();

    // Also sync daily / monthly target if passed in body or inferred from task title
    const targetInput = parseTargetInput(body);
    let syncDaily = targetInput.hasDaily ? targetInput.dailyTarget : undefined;
    let syncMonthly = targetInput.hasMonthly ? targetInput.monthlyTarget : undefined;
    const targetCountNum =
      body.target_count !== undefined ? Number(body.target_count || 0) || 0 : undefined;
    if (targetCountNum !== undefined && targetCountNum > 0) {
      const checkTitle = task.title || '';
      if (syncDaily === undefined && /daily/i.test(checkTitle)) {
        syncDaily = targetCountNum;
      }
      if (syncMonthly === undefined && /monthly/i.test(checkTitle)) {
        syncMonthly = targetCountNum;
      }
    }
    if ((syncDaily !== undefined || syncMonthly !== undefined) && task.assigned_to_id) {
      const synced = await syncEmployeeTargets(
        {
          employee_id: task.assigned_to_id,
          name: task.assigned_to,
        },
        syncDaily,
        syncMonthly
      );
      if (syncDaily !== undefined && /daily/i.test(task.title || '')) {
        task.target_count = synced.daily_target;
        await task.save();
      }
    }

    await logActivity({
      description: `Task "${task.title}" updated by ${auth.name} (status: ${task.status})`,
      subjectType: 'Task',
      causer: causerFromRequest(req),
    });

    return NextResponse.json({
      success: true,
      message: 'Task updated successfully.',
      data: serializeTask(task),
    });
  } catch (error: any) {
    console.error('PUT /api/tasks error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update task' },
      { status: 500 }
    );
  }
}

// ------------------------------------------------------------------ DELETE
export async function DELETE(req: Request) {
  try {
    await connectDB();

    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const scope = await getScope(auth);

    const { searchParams } = new URL(req.url);
    const idFromQuery = searchParams.get('id');
    const body = await req.json().catch(() => ({}));
    const id = String(idFromQuery || body.id || body._id || '').trim();

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Validation failed: Task id is required.' },
        { status: 400 }
      );
    }

    const task: any = await Task.findById(id).lean();
    if (!task) {
      return NextResponse.json(
        { success: false, message: 'Task not found.' },
        { status: 404 }
      );
    }

    const isCreator =
      Boolean(auth.employeeId) &&
      String(task.assigned_by_id || '') === String(auth.employeeId);
    const isManager = ['SM', 'ASM', 'BDM', 'MD'].includes(auth.role);
    const isManagerInScope =
      isManager &&
      canAccessEmployee(scope, task.assigned_to_id, task.assigned_to);

    if (!auth.isAdmin && !isCreator && !isManagerInScope) {
      return forbidden('You cannot delete this task.');
    }

    await Task.findByIdAndDelete(id);

    await logActivity({
      description: `Task "${task.title}" deleted by ${auth.name}`,
      subjectType: 'Task',
      causer: causerFromRequest(req),
    });

    return NextResponse.json({
      success: true,
      message: 'Task deleted successfully.',
    });
  } catch (error: any) {
    console.error('DELETE /api/tasks error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to delete task' },
      { status: 500 }
    );
  }
}
