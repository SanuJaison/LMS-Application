import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getNextStudentId } from '@/lib/studentId';
import { requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/leads/next-student-id
 * Returns the next sequential student ID. Requires a valid Bearer token.
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;

    const studentId = await getNextStudentId();
    return NextResponse.json({
      success: true,
      student_id: studentId,
      data: {
        student_id: studentId,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to generate student ID' },
      { status: 500 }
    );
  }
}
