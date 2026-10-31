import { NextResponse } from 'next/server';

/**
 * POST /api/logout
 */
export async function POST() {
  return NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  });
}
