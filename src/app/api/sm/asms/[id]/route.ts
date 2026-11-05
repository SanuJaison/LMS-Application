import { GET as listAsms, PUT as updateAsm } from '../route';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sm/asms/:id
 * Single Area Sales Manager by Mongo id, employee_id (ASM001) or email.
 * Delegates to GET /api/sm/asms?id=... so both lookup styles behave the same.
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const url = new URL(req.url);
  url.searchParams.set('id', params.id);

  return listAsms(
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

  return updateAsm(
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
