import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Leave } from '@/models';
import { numericId } from '@/lib/employeeAuth';
import {
  andFilter,
  canAccessEmployee,
  getScope,
  requireAuth,
  scopeFilter,
} from '@/lib/apiAuth';

/**
 * GET /api/leaves
 * Leave applications for the caller and, for managers, their team.
 * Requires a Bearer token; no token no longer returns every leave.
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const scope = await getScope(auth);

    const { searchParams } = new URL(req.url);
    const employeeParam = (searchParams.get('employee') || '').trim();

    const filters: Record<string, any>[] = [
      scopeFilter(scope, { nameFields: ['employee'] }),
    ];

    if (employeeParam) {
      if (!canAccessEmployee(scope, '', employeeParam)) {
        return NextResponse.json(
          { success: false, message: 'You cannot view this employee\'s leaves.' },
          { status: 403 }
        );
      }
      filters.push({
        employee: new RegExp(`^${escapeRegex(employeeParam)}$`, 'i'),
      });
    }

    const leaves = await Leave.find(andFilter(...filters))
      .sort({ createdAt: -1 })
      .lean();

    const data = leaves.map((l: any) => ({
      id: numericId(l._id) || 1,
      _id: l._id.toString(),
      employee: l.employee,
      leave_type: l.leave_type || 'Casual Leave',
      start_date: l.start_date,
      end_date: l.end_date,
      reason: l.reason || '',
      status: l.status || 'Pending',
    }));

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error: any) {
    console.error('GET /api/leaves error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch leaves' },
      { status: 500 }
    );
  }
}

function escapeRegex(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
