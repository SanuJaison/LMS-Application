import { POST as createInstitute } from '../route';

export const dynamic = 'force-dynamic';

/**
 * Alias for clients that follow the `/leads/create` pattern.
 * Identical behaviour to POST /api/institutes.
 */
export const POST = createInstitute;
