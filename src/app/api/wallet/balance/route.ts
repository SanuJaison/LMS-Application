import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Wallet, WalletWithdrawRequest } from '@/models';
import { Employee } from '@/models/employee';
import { numericId, toLaravelDate } from '@/lib/employeeAuth';
import { requireAuth } from '@/lib/apiAuth';

/**
 * GET /api/wallet/balance
 *
 * - Employee token: always their own wallet and their own withdrawal requests.
 * - Admin token: must pass ?employee_id= or ?employee=; there is no "all".
 *
 * Query params are ignored for employee tokens, so one employee can never read
 * another employee's wallet.
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const { searchParams } = new URL(req.url);

    let employeeName = '';
    let employeeId = '';

    if (auth.employee) {
      employeeName = auth.name;
      employeeId = auth.employeeId;
    } else {
      employeeName = (searchParams.get('employee') || '').trim();
      employeeId = (searchParams.get('employee_id') || '').trim();

      if (!employeeName && !employeeId) {
        return NextResponse.json(
          {
            success: false,
            message: 'Admin requests must specify ?employee_id= or ?employee=.',
          },
          { status: 400 }
        );
      }

      if (employeeId && !employeeName) {
        const target: any = await Employee.findOne({ employee_id: employeeId }).lean();
        if (target) employeeName = target.name;
      }
    }

    const walletQuery: Record<string, any> = {};
    if (employeeId) {
      walletQuery.$or = [
        { employee_id: employeeId },
        { employee: new RegExp(`^${escapeRegex(employeeName)}$`, 'i') },
      ];
    } else {
      walletQuery.employee = new RegExp(`^${escapeRegex(employeeName)}$`, 'i');
    }

    const wallet: any = await Wallet.findOne(walletQuery).lean();

    const currentBalance = wallet?.balance ?? 0;
    const totalEarned = wallet?.total_earned ?? currentBalance;
    const totalPaid = wallet?.total_paid ?? 0;

    const requests = await WalletWithdrawRequest.find(walletQuery)
      .sort({ createdAt: -1 })
      .lean();

    const formattedRequests = requests.map((r: any) => ({
      id: numericId(r._id) || r.request_id || 1,
      reference_id: r.request_id || `WDR-${numericId(r._id) || 1001}`,
      amount: r.amount || 0,
      status:
        r.status === 'Paid'
          ? 3
          : r.status === 'Rejected'
            ? 4
            : r.status === 'Approved'
              ? 2
              : 1, // 1: Pending, 2: Approved, 3: Paid, 4: Rejected
      status_label: r.status || 'Submitted to ASM',
      remarks: r.remarks || r.notes || r.description || '',
      created_at: toLaravelDate(r.createdAt),
    }));

    return NextResponse.json({
      success: true,
      data: {
        balance: currentBalance,
        total_earned: totalEarned,
        totalEarned: totalEarned,
        total_paid: totalPaid,
        totalPaid: totalPaid,
        currency: wallet?.currency || 'INR',
        employee: employeeName || wallet?.employee || 'Employee',
        withdraw_requests: {
          data: formattedRequests,
        },
        withdrawRequests: {
          data: formattedRequests,
        },
      },
    });
  } catch (error: any) {
    console.error('GET /api/wallet/balance error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch wallet balance' },
      { status: 500 }
    );
  }
}

function escapeRegex(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
