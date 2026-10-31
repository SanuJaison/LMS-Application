import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Wallet, WalletWithdrawRequest } from '@/models';
import { Employee } from '@/models/employee';
import { requireEmployee } from '@/lib/apiAuth';
import { logActivity, causerFromRequest } from '@/lib/activityLog';

/**
 * POST /api/wallet/withdraw
 * Submits an incentive withdrawal request for the signed-in employee.
 *
 * Rules:
 * - Max ₹5,000 per request.
 * - Routed through BDE -> ASM -> SM -> Accounts.
 * - Identity always comes from the Bearer token; body employee fields are ignored.
 */
export async function POST(req: Request) {
  try {
    await connectDB();

    const guard = await requireEmployee(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const employee = auth.employee;
    const body = await req.json().catch(() => ({}));

    const employeeName = auth.name;
    const employeeId = auth.employeeId;
    const team = employee?.team || '';
    const asmId = employee?.reports_to || '';

    let asmName = '';
    if (asmId) {
      const asmEmp: any = await Employee.findOne({ employee_id: asmId }).lean();
      if (asmEmp) asmName = asmEmp.name;
    }

    const amount = Number(body.amount || 0);

    if (amount <= 0) {
      return NextResponse.json(
        { success: false, message: 'Please enter a valid withdrawal amount.' },
        { status: 400 }
      );
    }

    if (amount > 5000) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Validation failed: Maximum allowed incentive withdrawal is ₹5,000 per request.',
        },
        { status: 400 }
      );
    }

    const wallet = await Wallet.findOne({
      $or: [
        { employee_id: employeeId },
        { employee: new RegExp(`^${escapeRegex(employeeName)}$`, 'i') },
      ],
    });

    const currentBalance = wallet?.balance ?? 0;
    if (amount > currentBalance) {
      return NextResponse.json(
        {
          success: false,
          message: `Insufficient wallet balance. Available balance: ₹${currentBalance}. Requested: ₹${amount}.`,
        },
        { status: 400 }
      );
    }

    const requestId = `WDR-${Math.floor(1000 + Math.random() * 9000)}`;

    const newRequest = await WalletWithdrawRequest.create({
      request_id: requestId,
      name: employeeName,
      employee: employeeName,
      employee_id: employeeId,
      designation: employee?.designation || 'Business Development Executive',
      team,
      asm_id: asmId,
      asm_name: asmName,
      amount,
      available_balance: currentBalance,
      upi_id: body.upi_id || employee?.upi_id || '',
      bank_name: body.bank_name || employee?.bank_name || '',
      account_number: body.account_number || employee?.account_number || '',
      ifsc_code: body.ifsc_code || employee?.ifsc_code || '',
      remarks: body.remarks || body.notes || 'Incentive withdrawal request',
      notes: body.remarks || body.notes || 'Incentive withdrawal request',
      status: 'Submitted to ASM',
      approval_history: [
        {
          step: 'Step 1 - BDE Request',
          actor: employeeName,
          role: 'BDE',
          action: 'Submitted to ASM',
          remarks: body.remarks || 'Requested incentive withdrawal',
          timestamp: new Date(),
        },
      ],
    });

    if (wallet) {
      wallet.balance = Math.max(0, wallet.balance - amount);
      await wallet.save();
    }

    await logActivity({
      description: `Incentive withdrawal request of ₹${amount} submitted by ${employeeName} to ASM ${asmName || asmId || ''}`,
      subjectType: 'Incentive Withdrawal',
      causer: causerFromRequest(req),
    });

    return NextResponse.json({
      success: true,
      message: `Incentive withdrawal request for ₹${amount} submitted successfully to ASM.`,
      data: {
        request_id: requestId,
        amount,
        status: 'Submitted to ASM',
        asm_name: asmName,
        remaining_balance: wallet?.balance ?? 0,
      },
    });
  } catch (error: any) {
    console.error('POST /api/wallet/withdraw error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to submit withdrawal request' },
      { status: 500 }
    );
  }
}

function escapeRegex(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
