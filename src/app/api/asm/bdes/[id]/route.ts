import { GET as listBdes, PUT as updateBde } from '../route';

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

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const url = new URL(req.url);
  url.searchParams.set('id', params.id);
  const bodyText = await req.text();

  return updateBde(
    new Request(url.toString(), {
      method: 'PUT',
      headers: req.headers,
      body: bodyText,
    })
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  return PUT(req, { params });
}
