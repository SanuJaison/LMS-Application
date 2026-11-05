import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Incentive } from '@/models/incentive';
import {
  andFilter,
  getScope,
  requireAuth,
  scopeFilter,
} from '@/lib/apiAuth';

/**
 * GET /api/incentives
 * Incentive records visible to the caller:
 *   - BDE        -> own incentives
 *   - ASM / BDM  -> own + direct reports
 *   - SM         -> own + whole subtree
 *   - admin      -> all
 *
 * Requires a Bearer token. Scope-override params (`?bde_id=`, `?asm_id=`,
 * `?team=`) are ignored for employee tokens, so a BDE can no longer read
 * another BDE's incentives.
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const scope = await getScope(auth);
    const { searchParams } = new URL(req.url);

    const isEmployee = !auth.isAdmin;
    const viewTeam = searchParams.get('view') === 'team';

    const filters: Record<string, any>[] = [];

    if (isEmployee && !viewTeam) {
      // By default, an employee (BDE, ASM, SM) views their own earned incentives
      filters.push({
        $or: [
          ...(auth.employeeId ? [{ bde_id: auth.employeeId }] : []),
          ...(auth.name ? [{ bde_name: new RegExp(`^${escapeRegex(auth.name)}$`, 'i') }] : []),
        ],
      });
    } else {
      // Admins or managers requesting team view see the hierarchy subtree
      filters.push(
        scopeFilter(scope, {
          idFields: ['bde_id', 'asm_id'],
          nameFields: ['bde_name', 'asm_name'],
        })
      );
    }

    // Only admins may narrow by arbitrary employee/team.
    if (auth.isAdmin) {
      const bdeId = searchParams.get('bde_id') || searchParams.get('employee_id');
      if (bdeId) filters.push({ bde_id: bdeId });

      const asmId = searchParams.get('asm_id');
      if (asmId) filters.push({ asm_id: asmId });

      const team = searchParams.get('team');
      if (team) filters.push({ team });
    }

    const status = searchParams.get('status');
    if (status) filters.push({ status });

    const records = await Incentive.find(andFilter(...filters))
      .sort({ createdAt: -1 })
      .lean();

    const totalIncentives = records.reduce((sum, r) => sum + (r.amount || 0), 0);
    const paidIncentives = records
      .filter((r) => r.status === 'Paid')
      .reduce((sum, r) => sum + (r.amount || 0), 0);
    const pendingIncentives = totalIncentives - paidIncentives;

    return NextResponse.json({
      success: true,
      count: records.length,
      summary: {
        total_incentives: totalIncentives,
        paid_incentives: paidIncentives,
        pending_incentives: pendingIncentives,
      },
      data: records,
    });
  } catch (error: any) {
    console.error('GET /api/incentives error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch incentives' },
      { status: 500 }
    );
  }
}

function escapeRegex(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
