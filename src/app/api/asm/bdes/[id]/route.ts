import { GET as listBdes } from '../route';

export const dynamic = 'force-dynamic';

/**
 * GET /api/asm/bdes/:id
 * Single Business Development Executive by Mongo id, employee_id (BDE001) or email.
 * Delegates to GET /api/asm/bdes?id=... so both lookup styles behave the same.
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const url = new URL(req.url);
  url.searchParams.set('id', params.id);

  return listBdes(
    new Request(url.toString(), {
      method: 'GET',
      headers: req.headers,
    })
  );
}
