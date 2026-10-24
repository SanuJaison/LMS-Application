import { handleChangePassword } from '@/lib/changePassword';

/**
 * POST /api/set-password
 * Alias of /api/employee/change-password, matching the mobile app's endpoint map.
 */
export async function POST(req: Request) {
  return handleChangePassword(req);
}
