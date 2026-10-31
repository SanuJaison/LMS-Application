import { ActivityLog } from '@/models';
import { extractTokenFromHeader, verifyToken } from './jwt';

export function causerFromRequest(req: Request): string {
  try {
    const token = extractTokenFromHeader(req);
    if (token) {
      const decoded = verifyToken(token);
      if (decoded?.name) return decoded.name;
      if (decoded?.email) return decoded.email;
    }
  } catch {}
  return 'System';
}

export async function logActivity({
  description,
  subjectType = 'General',
  causer = 'System',
}: {
  description: string;
  subjectType?: string;
  causer?: string;
}): Promise<any> {
  try {
    return await ActivityLog.create({
      description,
      subject_type: subjectType,
      causer_name: causer,
    });
  } catch (error) {
    console.warn('Failed to write activity log:', error);
    return null;
  }
}
