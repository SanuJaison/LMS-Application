import { ActivityLog } from '@/models';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';

/**
 * Audit trail helper.
 *
 * Every admin/app action that changes data calls `logActivity` so the
 * Activities page reflects what actually happened. Logging failures are
 * swallowed on purpose: an audit entry must never break the request it
 * describes.
 */

export interface ActivityEntry {
  description: string;
  subjectType?: string;
  causer?: string;
}

/**
 * Best-effort name of whoever made the request: the JWT carries the admin
 * user's or employee's name, so no extra DB lookup is needed.
 */
export function causerFromRequest(req: Request): string {
  const token = extractTokenFromHeader(req);
  const decoded = token ? verifyToken(token) : null;
  return decoded?.name || decoded?.email || 'System';
}

export async function logActivity({
  description,
  subjectType = 'General',
  causer = 'System',
}: ActivityEntry): Promise<void> {
  try {
    const text = (description || '').trim();
    if (!text) return;

    await ActivityLog.create({
      description: text.slice(0, 500),
      subject_type: subjectType || 'General',
      causer_name: causer || 'System',
    });
  } catch (error) {
    console.error('logActivity failed:', error);
  }
}
