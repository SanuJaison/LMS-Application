import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Wallet, WalletWithdrawRequest } from '@/models';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';
import { logActivity, causerFromRequest } from '@/lib/activityLog';

/**
 * POST /api/wallet/workflow
 * Moves an incentive withdrawal request through the approval route:
 * BDE -> ASM -> SM -> Accounts -> Payment
 *
 * Request Body:
 * {
 *   "request_id": "WDR-1001",
 *   "action": "forward_to_sm" | "forward_to_accounts" | "sanction" | "pay" | "reject",
 *   "remarks": "Verified incentive eligibility and forwarded",
 *   "transaction_reference": "TXN987654"
 * }
 */
export async function POST(req: Request) {
  try {
    await connectDB();

    const token = extractTokenFromHeader(req);
    const decoded = token ? verifyToken(token) : null;
    const actorName = decoded?.name || 'Administrator';
    const actorRole = decoded?.role || 'admin';

    const body = await req.json().catch(() => ({}));
    const { request_id, id, action, remarks, transaction_reference } = body;

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

    let nextStatus = request.status;
    let stepDescription = '';

    switch (action?.toLowerCase()) {
      case 'forward_to_sm':
      case 'asm_approve':
        nextStatus = 'Forwarded to SM';
        stepDescription = 'Step 2 – ASM Review: Forwarded to SM';
        break;

      case 'forward_to_accounts':
      case 'sm_approve':
        nextStatus = 'Forwarded to Accounts';
        stepDescription = 'Step 3 – SM Review: Forwarded to Accounts';
        break;

      case 'sanction':
      case 'approve':
      case 'accounts_approve':
        nextStatus = 'Approved';
        stepDescription = 'Step 4 – Accounts: Incentive withdrawal sanctioned';
        break;

      case 'pay':
      case 'mark_paid':
        nextStatus = 'Paid';
        stepDescription = 'Step 4 – Accounts: Incentive payment disbursed';
        request.transaction_reference = transaction_reference || `TXN-${Date.now()}`;
        request.payment_date = new Date();

        // Increment total_paid on the employee's wallet
        if (request.employee_id || request.employee) {
          await Wallet.findOneAndUpdate(
            {
              $or: [
                { employee_id: request.employee_id },
                { employee: new RegExp(`^${request.employee.trim()}$`, 'i') },
              ],
            },
            {
              $inc: { total_paid: request.amount || 0 },
            }
          );
        }
        break;

      case 'reject':
        nextStatus = 'Rejected';
        stepDescription = `Rejected by ${actorName}`;

        // Refund reserved balance back to the employee's wallet
        if (request.amount && (request.employee_id || request.employee)) {
          await Wallet.findOneAndUpdate(
            {
              $or: [
                { employee_id: request.employee_id },
                { employee: new RegExp(`^${request.employee.trim()}$`, 'i') },
              ],
            },
            {
              $inc: { balance: request.amount },
            }
          );
        }
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            message:
              'Invalid action. Valid actions: forward_to_sm, forward_to_accounts, sanction, pay, reject.',
          },
          { status: 400 }
        );
    }

    request.status = nextStatus;
    if (!Array.isArray(request.approval_history)) {
      request.approval_history = [];
    }

    request.approval_history.push({
      step: stepDescription,
      actor: actorName,
      role: actorRole,
      action: action.toUpperCase(),
      remarks: remarks || '',
      timestamp: new Date(),
    });

    await request.save();

    await logActivity({
      description: `Incentive withdrawal request ${request.request_id || request._id} updated to "${nextStatus}" by ${actorName}`,
      subjectType: 'Incentive Withdrawal',
      causer: causerFromRequest(req),
    });

    return NextResponse.json({
      success: true,
      message: `Withdrawal request status updated to "${nextStatus}".`,
      data: request,
    });
  } catch (error: any) {
    console.error('POST /api/wallet/workflow error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Workflow update failed' },
      { status: 500 }
    );
  }
}
