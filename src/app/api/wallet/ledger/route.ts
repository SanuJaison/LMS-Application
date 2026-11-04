import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Wallet, WalletWithdrawRequest } from '@/models';
import { Lead } from '@/models/lead';
import { requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

function escapeRegex(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * GET /api/wallet/ledger
 * Returns the earned admission incentives and ledger transactions for the caller.
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const employeeId = auth.employeeId;
    const employeeName = auth.name;

    const wallet: any = await Wallet.findOne({
      $or: [
        ...(employeeId ? [{ employee_id: employeeId }] : []),
        ...(employeeName ? [{ employee: new RegExp(`^${escapeRegex(employeeName)}$`, 'i') }] : []),
      ],
    }).lean();

    const isSm = auth.role === 'SM' || Boolean(auth.employee?.designation?.toLowerCase().includes('sales manager') && !auth.employee?.designation?.toLowerCase().includes('area'));
    const isAsm = auth.role === 'ASM' || Boolean(auth.employee?.designation?.toLowerCase().includes('area sales manager') || auth.employee?.designation?.toLowerCase().includes('office team lead'));

    const leadFilter: Record<string, any> = {
      $or: [
        { status: 4 },
        { admission_status: 'Admitted' },
        { admission_status: 'Closed' },
      ],
    };

    if (!isSm) {
      if (isAsm) {
        leadFilter.$and = [
          {
            $or: [
              ...(employeeId ? [{ asm_id: employeeId }, { employee_id: employeeId }] : []),
              ...(employeeName ? [{ asm_name: new RegExp(`^${escapeRegex(employeeName)}$`, 'i') }, { employee: new RegExp(`^${escapeRegex(employeeName)}$`, 'i') }] : []),
              ...(auth.employee?.team ? [{ team: new RegExp(`^${escapeRegex(auth.employee.team)}$`, 'i') }] : []),
            ],
          },
        ];
      } else {
        leadFilter.$and = [
          {
            $or: [
              ...(employeeId ? [{ employee_id: employeeId }, { bde_id: employeeId }] : []),
              ...(employeeName ? [{ employee: new RegExp(`^${escapeRegex(employeeName)}$`, 'i') }, { bde_name: new RegExp(`^${escapeRegex(employeeName)}$`, 'i') }] : []),
            ],
          },
        ];
      }
    }

    const [admissions, withdrawals] = await Promise.all([
      Lead.find(leadFilter)
        .sort({ updatedAt: -1 })
        .limit(50)
        .lean(),
      WalletWithdrawRequest.find({
        $or: [
          ...(employeeId ? [{ employee_id: employeeId }] : []),
          ...(employeeName ? [{ employee: new RegExp(`^${escapeRegex(employeeName)}$`, 'i') }] : []),
        ],
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);

    const ledger = admissions.map((l: any) => ({
      id: l._id.toString(),
      lead_id: l.lead_id || '',
      student_id: l.student_id || '',
      student_name: l.name || '',
      course: l.course_name || l.interested_course || '',
      incentive: isSm ? 20 : isAsm ? 100 : (l.incentive_amount || l.incentive_earned || 1000),
      type: 'credit',
      date: l.updatedAt || l.createdAt,
      status: 'Credited',
    }));

    return NextResponse.json({
      success: true,
      data: {
        balance: wallet?.balance ?? 0,
        total_earned: wallet?.total_earned ?? 0,
        total_withdrawn: wallet?.total_paid ?? 0,
        pending_withdrawals: wallet?.pending_withdrawal ?? 0,
        ledger,
        withdrawals,
      },
    });
  } catch (error: any) {
    console.error('GET /api/wallet/ledger error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch wallet ledger' },
      { status: 500 }
    );
  }
}
