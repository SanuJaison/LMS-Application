import { POST as recordFollowUp } from '../follow-up/route';

export const dynamic = 'force-dynamic';

/**
 * Alias for the mobile app, which calls `/leads/{id}/followup`
 * (no hyphen). Behaviour is identical to `/leads/{id}/follow-up`.
 */
export const POST = recordFollowUp;
