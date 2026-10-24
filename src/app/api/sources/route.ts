import { ok } from '@/lib/employeeAuth';

export const dynamic = 'force-dynamic';

const SOURCES = [
  'Campus Drive / College Seminar',
  'Cold Call',
  'Instagram Ad',
  'Facebook Ad',
  'WhatsApp Enquiry',
  'Walk-in',
  'Referral',
  'Website Form',
  'Google Ads',
  'Other',
];

/**
 * GET /api/sources
 * Lead source options used by the mobile lead form.
 */
export async function GET() {
  return ok(
    SOURCES.map((name, index) => ({ id: index + 1, name })),
    'Sources fetched successfully'
  );
}
