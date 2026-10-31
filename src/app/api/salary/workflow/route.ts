import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { SalaryRequest } from '@/models/salaryRequest';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';
import { logActivity, causerFromRequest } from '@/lib/activityLog';

/**
 * POST /api/salary/workflow
 * Moves a salary request through the official approval chain:
 * BDE -> ASM -> SM -> Accounts -> Payment Sanction
 *
 * Request Body:
 * {
 *   "request_id": "SAL-1001",
 *   "action": "forward_to_sm" | "forward_to_accounts" | "sanction" | "pay" | "reject",
 *   "remarks": "Verified attendance and approved",
 *   "transaction_reference": "TXN987654" (required when paying)
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

    const request = await SalaryRequest.findOne({
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

    let nextStatus = request.status;
    let stepDescription = '';

    switch (action?.toLowerCase()) {
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

    request.status = nextStatus as any;
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
      description: `Salary request ${request.request_id} updated to "${nextStatus}" by ${actorName}`,
      subjectType: 'Salary Request',
      causer: causerFromRequest(req),
    });

    return NextResponse.json({
      success: true,
      message: `Salary request ${request.request_id} status updated to "${nextStatus}".`,
      data: request,
    });
  } catch (error: any) {
    console.error('POST /api/salary/workflow error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Workflow update failed' },
      { status: 500 }
    );
  }
}
