import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Employee } from '@/models/employee';
import { Team, Wallet, EmployeeTask, Task } from '@/models';
import { authenticate, canAccessEmployee, getScope } from '@/lib/apiAuth';
import { hierarchyRole } from '@/lib/hierarchy';
import { escapeRegex } from '@/lib/employeeAuth';
import { logActivity } from '@/lib/activityLog';

/**
 * Shared handler for deleting an employee account:
 * - Self-deletion by any logged-in employee (SM, ASM, BDE, Telecaller) via Bearer token
 * - Deletion by passing `employee_id`, `id`, or `email` in body or query params
 * - Subordinate deletion by SM / ASM / Admin
 *
 * Permanently removes the employee from the `Employee` collection so:
 * 1. They are immediately removed from the Admin Portal Employees list.
 * 2. They can no longer log in via `POST /api/login`.
 */
export async function handleDeleteAccount(req: Request) {
  try {
    await connectDB();

    const auth = await authenticate(req);
    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));

    const requestedTarget = String(
      searchParams.get('employee_id') ||
        searchParams.get('id') ||
        searchParams.get('_id') ||
        searchParams.get('email') ||
        body.employee_id ||
        body.employeeId ||
        body.id ||
        body._id ||
        body.email ||
        ''
    ).trim();

    let targetEmployee: any = null;
    let isSelfDelete = false;

    if (requestedTarget) {
      targetEmployee =
        (requestedTarget.match(/^[0-9a-fA-F]{24}$/)
          ? await Employee.findById(requestedTarget).lean()
          : null) ||
        (await Employee.findOne({
          $or: [
            { employee_id: new RegExp(`^${escapeRegex(requestedTarget)}$`, 'i') },
            { email: requestedTarget.toLowerCase() },
          ],
        }).lean());

      if (!targetEmployee) {
        return NextResponse.json(
          {
            success: false,
            message: `Employee "${requestedTarget}" not found or already deleted.`,
          },
          { status: 404 }
        );
      }

      if (auth?.employee) {
        isSelfDelete =
          String(auth.employee._id) === String(targetEmployee._id) ||
          String(auth.employeeId || '').toUpperCase() ===
            String(targetEmployee.employee_id || '').toUpperCase();

        if (!isSelfDelete && !auth.isAdmin && auth.role !== 'MD') {
          const scope = await getScope(auth);
          if (
            !canAccessEmployee(
              scope,
              targetEmployee.employee_id,
              targetEmployee.name
            )
          ) {
            return NextResponse.json(
              {
                success: false,
                message: 'You do not have permission to delete this employee.',
              },
              { status: 403 }
            );
          }
        }
      } else {
        isSelfDelete = true;
      }
    } else if (auth?.employee) {
      targetEmployee = auth.employee;
      isSelfDelete = true;
    } else {
      return NextResponse.json(
        {
          success: false,
          message:
            'Authentication required. Send Authorization: Bearer <token> or provide employee_id.',
        },
        { status: 401 }
      );
    }

    const empDocId = targetEmployee._id;
    const empId = String(targetEmployee.employee_id || '').trim();
    const empName = String(targetEmployee.name || '').trim();
    const empTeam = String(targetEmployee.team || '').trim();
    const role = hierarchyRole(targetEmployee);

    // 1. Permanently delete the Employee document from MongoDB
    await Employee.findByIdAndDelete(empDocId);

    // 2. Clean up associated Wallet, EmployeeTask, and Task documents
    const empOr: any[] = [];
    if (empId) {
      empOr.push({ employee_id: new RegExp(`^${escapeRegex(empId)}$`, 'i') });
    }
    if (empName) {
      empOr.push({ employee: new RegExp(`^${escapeRegex(empName)}$`, 'i') });
    }
    if (empOr.length > 0) {
      await Promise.all([
        Wallet.deleteMany({ $or: empOr }),
        EmployeeTask.deleteMany({ $or: empOr }),
      ]);
    }

    const taskOr: any[] = [];
    if (empId) {
      taskOr.push({ assigned_to_id: new RegExp(`^${escapeRegex(empId)}$`, 'i') });
    }
    if (empName) {
      taskOr.push({ assigned_to: new RegExp(`^${escapeRegex(empName)}$`, 'i') });
    }
    if (taskOr.length > 0) {
      await Task.deleteMany({ $or: taskOr });
    }

    // 3. Update Team lead / member count if applicable
    if (empId || empName) {
      const leadPatterns: RegExp[] = [];
      if (empId) leadPatterns.push(new RegExp(escapeRegex(empId), 'i'));
      if (empName) leadPatterns.push(new RegExp(`^${escapeRegex(empName)}$`, 'i'));

      for (const pattern of leadPatterns) {
        await Team.updateMany(
          { team_lead: pattern },
          { $set: { team_lead: '' } }
        );
      }
    }

    if (empTeam) {
      const activeCount = await Employee.countDocuments({
        team: new RegExp(`^${escapeRegex(empTeam)}$`, 'i'),
        status: 'active',
      });
      await Team.updateOne(
        { name: new RegExp(`^${escapeRegex(empTeam)}$`, 'i') },
        { $set: { members_count: activeCount } }
      );
    }

    // 4. Write audit log
    const causerLabel =
      auth && !isSelfDelete
        ? `${auth.name} (${auth.employeeId || auth.role})`
        : `${empName} (${empId})`;

    await logActivity({
      description: isSelfDelete
        ? `${role} ${empName} (${empId}) deleted their own account`
        : `${causerLabel} deleted ${role} ${empName} (${empId})`,
      subjectType: 'Employee',
      causer: causerLabel,
    });

    return NextResponse.json({
      success: true,
      message: isSelfDelete
        ? `Account ${empName} (${empId}) has been permanently deleted.`
        : `Employee ${empName} (${empId}) has been permanently deleted.`,
      data: {
        id: String(empDocId),
        employee_id: empId,
        name: empName,
        role,
        deleted: true,
      },
    });
  } catch (error: any) {
    console.error('Delete account error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to delete account',
      },
      { status: 500 }
    );
  }
}
