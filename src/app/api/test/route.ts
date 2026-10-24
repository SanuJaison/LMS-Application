import { NextResponse } from 'next/server';
import { checkServerStatus } from '../server';

/**
 * GET /api/test
 * Quick endpoint to test MongoDB connection from your browser or API client.
 */
export async function GET() {
  const status = await checkServerStatus();
  return NextResponse.json(status, { status: status.success ? 200 : 500 });
}
