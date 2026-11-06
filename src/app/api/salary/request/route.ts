import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { SalaryRequest } from '@/models/salaryRequest';
import { requireEmployee } from '@/lib/apiAuth';
import { getCurrentSalaryPeriod, syncMonthlySalaries } from '@/lib/salarySync';

/**
 * POST /api/salary/request
 * Monthly salary (₹5,000 fixed base for SM, ASM, and BDE) is automatically credited
 * on the 1st of every month (outside Wallet; Wallet is strictly for incentives)
 * and decreases based on leaves taken. Employees do not need to request salary manually.
 */
export async function POST(req: Request) {
  try {
    await connectDB();

    const guard = await requireEmployee(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const period = getCurrentSalaryPeriod();

    await syncMonthlySalaries(period);

    const record = await SalaryRequest.findOne({
      employee_id: auth.employeeId,
      period,
    }).lean();

    return NextResponse.json({
      success: true,
      message:
        'Monthly salary (₹5,000 fixed base, adjusted for leaves) is automatically credited on the 1st of every month. No manual salary request is required.',
      data: record,
    });
  } catch (error: any) {
    console.error('POST /api/salary/request error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to check monthly salary' },
      { status: 500 }
    );
  }
}
