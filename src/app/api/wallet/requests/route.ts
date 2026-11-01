import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { WalletWithdrawRequest } from '@/models';
import {
  andFilter,
  getScope,
  requireAuth,
  scopeFilter,
} from '@/lib/apiAuth';
import { displayStatus } from '@/lib/workflowStatus';

/**
 * GET /api/wallet/requests
 * Incentive withdrawal requests visible to the caller:
 *   - BDE        -> own requests
 *   - ASM / BDM  -> requests from their direct BDEs
 *   - SM         -> every request in their subtree
 *   - admin      -> all (the admin panel can also use
 *                   GET /api/admin/wallet-withdraw-requests)
 *
 * Every row carries both the raw stage (`status`) and the dashboard label
 * (`status_label`): Pending / Approved / Paid / Rejected.
 *
 * Query params: ?status=Pending|Approved|Paid|Rejected,
 *               ?employee_id=, ?request_id=
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const scope = await getScope(auth);
    const { searchParams } = new URL(req.url);

    const filters: Record<string, any>[] = [
      scopeFilter(scope, {
        idFields: ['employee_id', 'asm_id'],
        nameFields: ['employee', 'name', 'asm_name'],
      }),
    ];

    const statusParam = (searchParams.get('status') || '').trim();
    if (statusParam) {
      const label = statusParam.toLowerCase();
      if (['pending', 'approved', 'paid', 'rejected'].includes(label)) {
        if (label === 'pending') {
          filters.push({
            status: { $nin: ['Approved', 'Paid', 'Rejected'] },
          });
        } else if (label === 'approved') {
          filters.push({ status: 'Approved' });
        } else if (label === 'paid') {
          filters.push({ status: 'Paid' });
        } else {
          filters.push({ status: 'Rejected' });
        }
      } else {
        // Raw stage filter, kept for backwards compatibility.
        filters.push({ status: statusParam });
      }
    }

    const requestId = (searchParams.get('request_id') || '').trim();
    if (requestId) filters.push({ request_id: requestId });

    // Only admins may narrow by arbitrary employee.
    if (auth.isAdmin) {
      const employeeId = (searchParams.get('employee_id') || '').trim();
      if (employeeId) filters.push({ employee_id: employeeId });
    }

    const requests = await WalletWithdrawRequest.find(andFilter(...filters))
      .sort({ createdAt: -1 })
      .lean();

    const data = requests.map((r: any) => ({
      id: r._id.toString(),
      request_id: r.request_id || '',
      name: r.name || r.employee || '',
      employee: r.employee || r.name || '',
      employee_id: r.employee_id || '',
      designation: r.designation || '',
      team: r.team || '',
      asm_id: r.asm_id || '',
      asm_name: r.asm_name || '',
      sm_id: r.sm_id || '',
      sm_name: r.sm_name || '',
      amount: r.amount || 0,
      available_balance: r.available_balance || 0,
      status: r.status || 'Submitted to ASM',
      status_label: displayStatus(r.status),
      remarks: r.remarks || r.notes || '',
      approval_history: r.approval_history || [],
      transaction_reference: r.transaction_reference || '',
      payment_date: r.payment_date || null,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    }));

    const pending = data.filter((r) => r.status_label === 'Pending').length;
    const approved = data.filter((r) => r.status_label === 'Approved').length;
    const paid = data.filter((r) => r.status_label === 'Paid').length;
    const rejected = data.filter((r) => r.status_label === 'Rejected').length;

    return NextResponse.json({
      success: true,
      count: data.length,
      summary: {
        total: data.length,
        pending,
        approved,
        paid,
        rejected,
        pending_amount: data
          .filter((r) => r.status_label === 'Pending')
          .reduce((sum, r) => sum + r.amount, 0),
      },
      data,
    });
  } catch (error: any) {
    console.error('GET /api/wallet/requests error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to fetch withdrawal requests',
      },
      { status: 500 }
    );
  }
}
