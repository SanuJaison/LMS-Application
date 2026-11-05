import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { SalaryRequest } from '@/models/salaryRequest';
import { logActivity, causerFromRequest } from '@/lib/activityLog';
import {
  canAccessEmployee,
  forbidden,
  getScope,
  requireAuth,
} from '@/lib/apiAuth';
import { displayStatus, transitionProblem } from '@/lib/workflowStatus';

/**
 * POST /api/salary/workflow
 * Moves a salary request through BDE -> ASM -> SM -> Accounts -> Payment.
 *
 * Authorization per action:
 *   forward_to_sm / asm_approve        -> ASM / BDM / SM / admin
 *   forward_to_accounts / sm_approve   -> SM / admin
 *   sanction / approve / pay           -> admin only
 *   reject                             -> ASM / BDM / SM / admin
 *
 * Non-admin callers can only act on requests inside their own hierarchy.
 */
export async function POST(req: Request) {
  try {
    await connectDB();

    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const body = await req.json().catch(() => ({}));
    const { request_id, id, action, remarks, transaction_reference } = body;

    const normalizedAction = String(action || '').toLowerCase();

    const allowed: Record<string, string[]> = {
      forward_to_sm: ['ASM', 'BDM', 'SM', 'ADMIN'],
      asm_approve: ['ASM', 'BDM', 'SM', 'ADMIN'],
      forward_to_accounts: ['SM', 'ADMIN'],
      sm_approve: ['SM', 'ADMIN'],
      sanction: ['ADMIN'],
      approve: ['ADMIN'],
      accounts_approve: ['ADMIN'],
      pay: ['ADMIN'],
      mark_paid: ['ADMIN'],
      reject: ['ASM', 'BDM', 'SM', 'ADMIN'],
    };

    if (!allowed[normalizedAction]) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Invalid action. Valid actions: forward_to_sm, forward_to_accounts, sanction, pay, reject.',
        },
        { status: 400 }
      );
    }

    if (!allowed[normalizedAction].includes(auth.role)) {
      return forbidden(
        `Action "${normalizedAction}" requires one of: ${allowed[normalizedAction].join(', ')}.`
      );
    }

    const request: any = await SalaryRequest.findOne({
      $or: [
        { request_id: request_id || id },
        ...(id && /^[0-9a-fA-F]{24}$/.test(id) ? [{ _id: id }] : []),
      ],
    });

    if (!request) {
      return NextResponse.json(
        { success: false, message: 'Salary request not found' },
        { status: 404 }
      );
    }

    if (!auth.isAdmin && auth.role !== 'SM' && auth.role !== 'MD') {
      const scope = await getScope(auth);
      const inScope =
        canAccessEmployee(scope, request.employee_id, request.employee_name) ||
        canAccessEmployee(scope, request.asm_id, request.asm_name);

      if (!inScope) {
        return forbidden('This salary request is outside your hierarchy.');
      }
    }

    const actorName = auth.name || 'Administrator';
    const actorRole = auth.role;

    const problem = transitionProblem(normalizedAction, request.status);
    if (problem) {
      return NextResponse.json(
        { success: false, message: problem, status: request.status },
        { status: 400 }
      );
    }

    let nextStatus = request.status;
    let stepDescription = '';

    switch (normalizedAction) {
      case 'forward_to_sm':
      case 'asm_approve':
        nextStatus = 'Forwarded to SM';
        stepDescription = 'Step 2 – ASM Review: Approved and forwarded to SM';
        break;

      case 'forward_to_accounts':
      case 'sm_approve':
        nextStatus = 'Forwarded to Accounts';
        stepDescription = 'Step 3 – SM Review: Verified and forwarded to Accounts';
        break;

      case 'sanction':
      case 'approve':
      case 'accounts_approve':
        nextStatus = 'Approved';
        stepDescription = 'Step 4 – Accounts: Payment sanctioned';
        break;

      case 'pay':
      case 'mark_paid':
        nextStatus = 'Paid';
        stepDescription = 'Step 4 – Accounts: Payment completed';
        request.transaction_reference = transaction_reference || `TXN-${Date.now()}`;
        request.payment_date = new Date();
        break;

      case 'reject':
        nextStatus = 'Rejected';
        stepDescription = `Rejected by ${actorName}`;
        break;
    }

    request.status = nextStatus as any;
    if (!Array.isArray(request.approval_history)) {
      request.approval_history = [];
    }
    request.approval_history.push({
      step: stepDescription,
      actor: actorName,
      role: actorRole,
      action: normalizedAction.toUpperCase(),
      remarks: remarks || '',
      timestamp: new Date(),
    });

    await request.save();

    await logActivity({
      description: `Salary request ${request.request_id} updated to "${nextStatus}" by ${actorName}`,
      subjectType: 'Salary Request',
      causer: causerFromRequest(req),
    });

    return NextResponse.json({
      success: true,
      message: `Salary request ${request.request_id} status updated to "${nextStatus}".`,
      data: {
        ...request.toObject(),
        status: nextStatus,
        status_label: displayStatus(nextStatus),
      },
    });
  } catch (error: any) {
    console.error('POST /api/salary/workflow error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Workflow update failed' },
      { status: 500 }
    );
  }
}
