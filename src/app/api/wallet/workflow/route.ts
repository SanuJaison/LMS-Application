import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Wallet, WalletWithdrawRequest } from '@/models';
import { logActivity, causerFromRequest } from '@/lib/activityLog';
import {
  canAccessEmployee,
  forbidden,
  getScope,
  requireAuth,
} from '@/lib/apiAuth';
import {
  displayStatus,
  transitionProblem,
} from '@/lib/workflowStatus';

/**
 * POST /api/wallet/workflow
 * Moves an incentive withdrawal request through the strict approval chain:
 * - BDE request ("Submitted to ASM") -> ASM forwards to SM ("Forwarded to SM")
 * - ASM request or ASM-forwarded BDE request ("Forwarded to SM") -> SM forwards to Admin ("Forwarded to Accounts")
 * - SM request or SM-forwarded request ("Forwarded to Accounts") -> Admin sanctions ("Approved") & pays ("Paid")
 *
 * Authorization per action:
 *   forward_to_sm / asm_approve          -> ASM / BDM / admin
 *   forward_to_accounts / sm_approve     -> SM / admin
 *   sanction / approve / accounts_approve -> admin only (when ASM/SM passes "approve"/"forward", it auto-maps to their forward action)
 *   pay / mark_paid                      -> admin only
 *   reject                               -> ASM (at Submitted to ASM), SM (at Forwarded to SM), admin (any pending stage)
 */
export async function POST(req: Request) {
  try {
    await connectDB();

    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const body = await req.json().catch(() => ({}));
    const { request_id, id, action, remarks, transaction_reference } = body;

    let normalizedAction = String(action || '').trim().toLowerCase();

    // If app side sends generic "approve" or "forward" for ASM or SM, map it to their role's forward step:
    // ASM forwards to SM; SM forwards to Admin/Accounts.
    if (normalizedAction === 'forward' || normalizedAction === 'approve') {
      if (auth.role === 'ASM' || auth.role === 'BDM') {
        normalizedAction = 'forward_to_sm';
      } else if (auth.role === 'SM') {
        normalizedAction = 'forward_to_accounts';
      } else if (auth.isAdmin && normalizedAction === 'forward') {
        normalizedAction = 'sanction';
      }
    }

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

    const request: any = await WalletWithdrawRequest.findOne({
      $or: [
        { request_id: request_id || id },
        ...(id && /^[0-9a-fA-F]{24}$/.test(id) ? [{ _id: id }] : []),
      ],
    });

    if (!request) {
      return NextResponse.json(
        { success: false, message: 'Withdrawal request not found' },
        { status: 404 }
      );
    }

    if (!auth.isAdmin && auth.role !== 'SM' && auth.role !== 'MD') {
      const scope = await getScope(auth);
      const sameTeam =
        Boolean(auth.team) &&
        Boolean(request.team) &&
        String(auth.team).toLowerCase() === String(request.team).toLowerCase();
      const inScope =
        sameTeam ||
        canAccessEmployee(scope, request.employee_id, request.employee) ||
        canAccessEmployee(scope, request.asm_id, request.asm_name);

      if (!inScope) {
        return forbidden('This withdrawal request is outside your hierarchy.');
      }
    }

    // Prevent an employee from approving/forwarding their own withdrawal request
    if (
      !auth.isAdmin &&
      auth.employeeId &&
      String(request.employee_id || '').toUpperCase() === auth.employeeId.toUpperCase()
    ) {
      return forbidden('You cannot approve or forward your own incentive withdrawal request.');
    }

    // Role-specific stage guards for reject
    if (normalizedAction === 'reject' && !auth.isAdmin) {
      if ((auth.role === 'ASM' || auth.role === 'BDM') && request.status !== 'Submitted to ASM') {
        return NextResponse.json(
          {
            success: false,
            message: `ASM can only reject requests in "Submitted to ASM" stage (current: "${request.status}").`,
          },
          { status: 400 }
        );
      }
      if (auth.role === 'SM' && request.status === 'Forwarded to Accounts') {
        return NextResponse.json(
          {
            success: false,
            message: 'This request has already been forwarded to Admin and can only be acted on by Admin.',
          },
          { status: 400 }
        );
      }
    }

    const problem = transitionProblem(normalizedAction, request.status);
    if (problem) {
      return NextResponse.json(
        { success: false, message: problem, status: request.status },
        { status: 400 }
      );
    }

    const actorName = auth.name || 'Administrator';
    const actorRole = auth.role;

    let nextStatus = request.status;
    let stepDescription = '';

    switch (normalizedAction) {
      case 'forward_to_sm':
      case 'asm_approve':
        nextStatus = 'Forwarded to SM';
        stepDescription = 'Step 2 - ASM Review: Approved & Forwarded to SM';
        break;

      case 'forward_to_accounts':
      case 'sm_approve':
        nextStatus = 'Forwarded to Accounts';
        stepDescription = 'Step 3 - SM Review: Approved & Forwarded to Admin';
        break;

      case 'sanction':
      case 'approve':
      case 'accounts_approve':
        nextStatus = 'Approved';
        stepDescription = 'Step 4 - Admin/Accounts: Incentive withdrawal sanctioned';
        request.payment_date = request.payment_date || new Date();
        request.transaction_reference =
          request.transaction_reference ||
          transaction_reference ||
          `TXN-${Date.now()}`;
        await Wallet.findOneAndUpdate(
          {
            $or: [
              { employee_id: request.employee_id },
              {
                employee: new RegExp(
                  `^${escapeRegex(request.employee || '')}$`,
                  'i'
                ),
              },
            ],
          },
          { $inc: { total_paid: request.amount || 0 } }
        );
        break;

      case 'pay':
      case 'mark_paid':
        nextStatus = 'Paid';
        stepDescription = 'Step 4 - Admin/Accounts: Incentive payment disbursed';
        request.transaction_reference =
          request.transaction_reference ||
          transaction_reference ||
          `TXN-${Date.now()}`;
        request.payment_date = request.payment_date || new Date();
        break;

      case 'reject':
        nextStatus = 'Rejected';
        stepDescription = `Rejected by ${actorName} (${actorRole})`;

        if (request.amount && (request.employee_id || request.employee)) {
          await Wallet.findOneAndUpdate(
            {
              $or: [
                { employee_id: request.employee_id },
                {
                  employee: new RegExp(
                    `^${escapeRegex(request.employee || '')}$`,
                    'i'
                  ),
                },
              ],
            },
            { $inc: { balance: request.amount } }
          );
        }
        break;
    }

    request.status = nextStatus;
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
      description: `Incentive withdrawal request ${
        request.request_id || request._id
      } updated to "${nextStatus}" by ${actorName}`,
      subjectType: 'Incentive Withdrawal',
      causer: causerFromRequest(req),
    });

    return NextResponse.json({
      success: true,
      message: `Withdrawal request status updated to "${nextStatus}".`,
      data: {
        ...request.toObject(),
        status: nextStatus,
        status_label: displayStatus(nextStatus),
      },
    });
  } catch (error: any) {
    console.error('POST /api/wallet/workflow error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Workflow update failed' },
      { status: 500 }
    );
  }
}

function escapeRegex(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
