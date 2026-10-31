import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Wallet, WalletWithdrawRequest } from '@/models';
import { Employee } from '@/models/employee';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';
import { numericId, toLaravelDate } from '@/lib/employeeAuth';

/**
 * GET /api/wallet/balance
 * Returns wallet balance, earned incentives, paid amount, and withdrawal requests.
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const token = extractTokenFromHeader(req);
    const decoded = token ? verifyToken(token) : null;

    let employeeName = '';
    let employeeId = '';

    if (decoded?.role === 'employee' && decoded.id) {
      const me: any = await Employee.findById(decoded.id).lean();
      if (me) {
        employeeName = me.name;
        employeeId = me.employee_id;
      }
    } else {
      const { searchParams } = new URL(req.url);
      employeeName = searchParams.get('employee') || '';
      employeeId = searchParams.get('employee_id') || '';
    }

    const walletQuery: Record<string, any> = {};
    if (employeeId) {
      walletQuery.$or = [
        { employee_id: employeeId },
        { employee: new RegExp(`^${employeeName.trim()}$`, 'i') },
      ];
    } else if (employeeName) {
      walletQuery.employee = new RegExp(`^${employeeName.trim()}$`, 'i');
    }

    let wallet: any = null;
    if (employeeId || employeeName) {
      wallet = await Wallet.findOne(walletQuery).lean();
    }

    const currentBalance = wallet?.balance ?? 0;
    const totalEarned = wallet?.total_earned ?? currentBalance;
    const totalPaid = wallet?.total_paid ?? 0;

    // Fetch withdrawal requests for this employee
    const requestQuery: Record<string, any> = {};
    if (employeeId) {
      requestQuery.$or = [
        { employee_id: employeeId },
        { employee: new RegExp(`^${employeeName.trim()}$`, 'i') },
      ];
    } else if (employeeName) {
      requestQuery.employee = new RegExp(`^${employeeName.trim()}$`, 'i');
    }

    const requests = await WalletWithdrawRequest.find(requestQuery)
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
