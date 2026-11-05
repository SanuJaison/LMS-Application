import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { SalaryRequest } from '@/models/salaryRequest';
import {
  andFilter,
  getScope,
  requireAuth,
  scopeFilter,
} from '@/lib/apiAuth';
import { displayStatus } from '@/lib/workflowStatus';

/**
 * GET /api/salary/requests
 * Salary requests visible to the caller:
 *   - BDE        -> own requests
 *   - ASM / BDM  -> own + direct reports
 *   - SM         -> own + whole subtree
 *   - admin      -> all
 *
 * Requires a Bearer token; no token no longer returns every request.
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const scope = await getScope(auth);
    const { searchParams } = new URL(req.url);

    const mineParam = (searchParams.get('mine') || '').trim().toLowerCase();
    const filters: Record<string, any>[] = [];

    if (mineParam === 'true' || mineParam === '1') {
      filters.push({
        $or: [
          ...(auth.employeeId ? [{ employee_id: auth.employeeId }] : []),
          ...(auth.name ? [{ employee_name: auth.name }] : []),
        ],
      });
    } else if (!auth.isAdmin && auth.role !== 'SM' && auth.role !== 'MD') {
      filters.push(
        scopeFilter(scope, {
          idFields: ['employee_id', 'asm_id', 'sm_id'],
          nameFields: ['employee_name', 'asm_name', 'sm_name'],
        })
      );
    }

    if (auth.isAdmin || auth.role === 'SM' || auth.role === 'ASM' || auth.role === 'BDM') {
      const employeeId = (searchParams.get('employee_id') || '').trim();
      if (employeeId) filters.push({ employee_id: employeeId });
    }

    const statusParam = searchParams.get('status');
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
        filters.push({ status: statusParam });
      }
    }

    const requests = await SalaryRequest.find(andFilter(...filters))
      .sort({ createdAt: -1 })
      .lean();

    const data = requests.map((r: any) => ({
      ...r,
      status_label: displayStatus(r.status),
    }));

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error: any) {
    console.error('GET /api/salary/requests error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch salary requests' },
      { status: 500 }
    );
  }
}
