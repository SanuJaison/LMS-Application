import { connectDB } from '@/lib/db';
import { Wallet } from '@/models';
import { getEmployee, nameRegex, ok } from '@/lib/employeeAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/wallet/balance
 */
export async function GET(req: Request) {
  try {
    await connectDB();
    const employee = await getEmployee(req);

    if (!employee) {
      return ok({ balance: 0, currency: 'INR' }, 'Unauthenticated');
    }

    const nameFilter = nameRegex(employee.name);
    const wallet: any = nameFilter ? await Wallet.findOne({ employee: nameFilter }).lean() : null;

    return ok(
      {
        balance: wallet?.balance || 0,
        currency: wallet?.currency || 'INR',
        employee: employee.name,
      },
      'Wallet balance fetched successfully'
    );
  } catch (error: any) {
    console.error('GET /api/wallet/balance error:', error);
    return ok({ balance: 0, currency: 'INR' }, 'Wallet balance unavailable');
  }
}
