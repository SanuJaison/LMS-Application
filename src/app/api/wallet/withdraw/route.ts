import { connectDB } from '@/lib/db';
import { Wallet, WalletWithdrawRequest } from '@/models';
import { getEmployee, nameRegex, ok } from '@/lib/employeeAuth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/wallet/withdraw
 * Body: { amount, upi_id?, description? }
 */
export async function POST(req: Request) {
  try {
    await connectDB();
    const employee = await getEmployee(req);

    if (!employee) {
      return ok(null, 'Unauthenticated', 401);
    }

    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount || 0);

    if (!amount || amount <= 0) {
      return ok(null, 'A valid amount is required', 400);
    }

    const nameFilter = nameRegex(employee.name);
    const wallet: any = nameFilter ? await Wallet.findOne({ employee: nameFilter }) : null;

    if (!wallet) {
      return ok(null, 'No wallet found for this employee', 404);
    }

    if (amount > wallet.balance) {
      return ok(null, 'Insufficient wallet balance', 400);
    }

    wallet.balance = wallet.balance - amount;
    await wallet.save();

    const request = await WalletWithdrawRequest.create({
      name: employee.name,
      title: employee.name,
      employee: employee.name,
      email: employee.email || '',
      phone: employee.contact_number || '',
      contact: employee.contact_number || '',
      amount,
      description: String(body.description || body.notes || ''),
      notes: String(body.upi_id || ''),
      status: 'Pending',
    });

    return ok(
      { request, balance: wallet.balance, currency: wallet.currency || 'INR' },
      'Withdrawal request submitted successfully',
      201
    );
  } catch (error: any) {
    console.error('POST /api/wallet/withdraw error:', error);
    return ok(null, error.message || 'Failed to submit withdrawal request', 500);
  }
}
