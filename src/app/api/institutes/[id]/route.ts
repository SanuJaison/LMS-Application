import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { Institute } from '@/models/institute';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/institutes/:id
 *
 * Admin / manager only. `:id` accepts the Mongo id or the numeric legacy id.
 */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();

    const token = extractTokenFromHeader(req);
    const decoded = token ? verifyToken(token) : null;

    if (!decoded || (decoded.role !== 'admin' && decoded.role !== 'manager')) {
      return NextResponse.json(
        { success: false, message: 'Only admins can delete institutes.' },
        { status: 403 }
      );
    }

    const value = String(params.id || '').trim();
    const filter = mongoose.isValidObjectId(value)
      ? { _id: value }
      : /^\d+$/.test(value)
        ? { legacy_id: Number(value) }
        : null;

    if (!filter) {
      return NextResponse.json(
        { success: false, message: 'Invalid institute id.' },
        { status: 400 }
      );
    }

    const deleted = await Institute.findOneAndDelete(filter);

    if (!deleted) {
      return NextResponse.json(
        { success: false, message: 'Institute not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Institute ${deleted.institute_name} deleted successfully`,
    });
  } catch (error: any) {
    console.error('DELETE /api/institutes/[id] error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to delete institute' },
      { status: 500 }
    );
  }
}
