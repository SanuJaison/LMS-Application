import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Incentive } from '@/models/incentive';
import { Employee } from '@/models/employee';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';
import { hierarchyRole } from '@/lib/hierarchy';

/**
 * GET /api/incentives
 * Lists individual incentive records for closed admissions.
 * Supports role-based filtering:
 * - BDE sees own incentives
 * - ASM sees team incentives
 * - SM & Admin/Accounts see all
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const token = extractTokenFromHeader(req);
    const decoded = token ? verifyToken(token) : null;
    const { searchParams } = new URL(req.url);

    const query: Record<string, any> = {};

    if (decoded?.role === 'employee' && decoded.id) {
      const me: any = await Employee.findById(decoded.id).lean();
      if (me) {
        const role = hierarchyRole(me);
        if (role === 'BDE') {
          query.bde_id = me.employee_id;
        } else if (role === 'ASM') {
          query.$or = [{ asm_id: me.employee_id }, { team: me.team }];
        }
      }
    }

    const bdeId = searchParams.get('bde_id') || searchParams.get('employee_id');
    if (bdeId) query.bde_id = bdeId;

    const asmId = searchParams.get('asm_id');
    if (asmId) query.asm_id = asmId;

    const team = searchParams.get('team');
    if (team) query.team = team;

    const status = searchParams.get('status');
    if (status) query.status = status;

    const records = await Incentive.find(query)
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
