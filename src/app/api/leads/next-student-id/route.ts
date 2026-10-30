import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getNextStudentId } from '@/lib/studentId';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectDB();
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
