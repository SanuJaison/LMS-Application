import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { SalaryRequest } from '@/models/salaryRequest';
import { Employee } from '@/models/employee';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';
import { hierarchyRole } from '@/lib/hierarchy';

/**
 * GET /api/salary/requests
 * Lists salary requests according to the caller's role:
 * - BDE: sees only their own requests
 * - ASM: sees requests from BDEs under their team
 * - SM: sees requests forwarded by ASMs
 * - Admin / Accounts: sees all requests
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
          query.employee_id = me.employee_id;
        } else if (role === 'ASM') {
          query.$or = [{ asm_id: me.employee_id }, { team: me.team }];
        }
        // SM and Admin see all
      }
    }

    const statusParam = searchParams.get('status');
    if (statusParam) {
      query.status = statusParam;
    }

    const requests = await SalaryRequest.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error: any) {
    console.error('GET /api/salary/requests error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch salary requests' },
      { status: 500 }
    );
  }
}
