import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;

    return NextResponse.json({
      success: true,
      count: 0,
      data: [],
      notifications: [],
      unread_count: 0,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: true,
      count: 0,
      data: [],
      notifications: [],
      unread_count: 0,
    });
  }
}
