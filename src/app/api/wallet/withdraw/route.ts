import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Wallet, WalletWithdrawRequest } from '@/models';
import { Employee } from '@/models/employee';
import { requireEmployee } from '@/lib/apiAuth';
import { logActivity, causerFromRequest } from '@/lib/activityLog';

/**
 * POST /api/wallet/withdraw
 * Submits an incentive withdrawal request for the signed-in employee.
 * (Wallet is strictly for incentives; monthly ₹5k salary is auto-credited separately).
 *
 * Approval Chain Rules:
 * - BDE -> requests to ASM ("Submitted to ASM") -> ASM forwards to SM ("Forwarded to SM") -> SM forwards to Admin ("Forwarded to Accounts") -> Admin approves/pays.
 * - ASM -> requests to SM ("Forwarded to SM") -> SM forwards to Admin ("Forwarded to Accounts") -> Admin approves/pays.
 * - SM  -> requests directly to Admin ("Forwarded to Accounts") -> Admin approves/pays.
 * - Max ₹5,000 per request.
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
    const isSm = auth.role === 'SM';
    const isAsm = auth.role === 'ASM' || auth.role === 'BDM';

    // Resolve the statewide SM
    const smEmp: any = isSm
      ? employee
      : await Employee.findOne({
          status: { $ne: 'inactive' },
          $or: [
            { employee_id: /^SM/i },
            { designation: /^sales manager$|^state manager$/i },
          ],
        }).lean();

    const smId = smEmp?.employee_id || 'SM001';
    const smName = smEmp?.name || 'Sales Manager';

    // Resolve the BDE's ASM (via reports_to or matching team's ASM)
    let asmId = '';
    let asmName = '';
    if (!isSm && !isAsm) {
      let asmEmp: any = null;
      if (employee?.reports_to) {
        asmEmp = await Employee.findOne({
          employee_id: employee.reports_to,
        }).lean();
      }
      if (
        (!asmEmp || String(asmEmp.employee_id || '').toUpperCase().startsWith('SM')) &&
        team
      ) {
        const teamAsm: any = await Employee.findOne({
          status: { $ne: 'inactive' },
          team: new RegExp(`^${escapeRegex(team)}$`, 'i'),
          $or: [
            { employee_id: /^ASM/i },
            { designation: /area sales manager|office team lead/i },
          ],
        }).lean();
        if (teamAsm) asmEmp = teamAsm;
      }
      asmId = asmEmp?.employee_id || employee?.reports_to || '';
      asmName = asmEmp?.name || '';
    } else if (isAsm) {
      asmId = employeeId;
      asmName = employeeName;
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

    const initialStatus = isSm
      ? 'Forwarded to Accounts'
      : isAsm
        ? 'Forwarded to SM'
        : 'Submitted to ASM';

    const defaultDesignation = isSm
      ? 'Sales Manager'
      : isAsm
        ? 'Area Sales Manager'
        : 'Business Development Executive';

    const stepDescription = isSm
      ? 'Step 1 - SM Request: Submitted directly to Admin'
      : isAsm
        ? 'Step 1 - ASM Request: Submitted to SM'
        : 'Step 1 - BDE Request: Submitted to ASM';

    const targetLabel = isSm ? 'Admin' : isAsm ? 'SM' : 'ASM';

    const email = String(body.email || employee?.email || '').trim();
    const phone = String(
      body.phone || body.contact_number || employee?.contact_number || employee?.phone || ''
    ).trim();
    const upiId = String(body.upi_id || employee?.upi_id || '').trim();
    const contactDisplay = upiId || phone || email || '';
    const noteText =
      body.remarks || body.notes || body.description || 'Incentive withdrawal request';

    const newRequest = await WalletWithdrawRequest.create({
      request_id: requestId,
      name: employeeName,
      title: employeeName,
      employee: employeeName,
      employee_id: employeeId,
      designation: employee?.designation || defaultDesignation,
      team: team || (isSm ? 'Statewide' : ''),
      asm_id: asmId,
      asm_name: asmName,
      sm_id: smId,
      sm_name: smName,
      email,
      phone,
      contact: contactDisplay,
      amount,
      available_balance: currentBalance,
      upi_id: upiId,
      bank_name: body.bank_name || employee?.bank_name || '',
      account_number: body.account_number || employee?.account_number || '',
      ifsc_code: body.ifsc_code || employee?.ifsc_code || '',
      description: noteText,
      remarks: noteText,
      notes: noteText,
      status: initialStatus,
      approval_history: [
        {
          step: stepDescription,
          actor: employeeName,
          role: auth.role,
          action: initialStatus,
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
      description: `Incentive withdrawal request of ₹${amount} submitted by ${employeeName} (${employeeId}) to ${targetLabel}`,
      subjectType: 'Incentive Withdrawal',
      causer: causerFromRequest(req),
    });

    return NextResponse.json({
      success: true,
      message: `Incentive withdrawal request for ₹${amount} submitted successfully to ${targetLabel}.`,
      data: {
        id: newRequest._id.toString(),
        request_id: requestId,
        employee_id: employeeId,
        employee: employeeName,
        designation: employee?.designation || defaultDesignation,
        amount,
        status: initialStatus,
        status_label: 'Pending',
        asm_name: asmName,
        sm_name: smName,
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
