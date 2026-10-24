import { handleChangePassword } from '@/lib/changePassword';

/**
 * POST /api/employee/change-password
 * Lets an employee change their own password from the mobile app.
 */
export async function POST(req: Request) {
  return handleChangePassword(req);
}
