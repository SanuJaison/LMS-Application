import { getEmployee, ok, serializeEmployee } from '@/lib/employeeAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/profile
 * Returns the signed-in employee's profile.
 */
export async function GET(req: Request) {
  const employee = await getEmployee(req);

  if (!employee) {
    return ok(null, 'Unauthenticated');
  }

  return ok(
    {
      ...serializeEmployee(employee),
      designation: employee.designation || '',
      contact_number: employee.contact_number || '',
      status: employee.status || 'active',
      upi_id: employee.upi_id || '',
      bank_name: employee.bank_name || '',
      account_holder_name: employee.account_holder_name || '',
      account_number: employee.account_number || '',
      ifsc_code: employee.ifsc_code || '',
    },
    'Profile fetched successfully'
  );
}
