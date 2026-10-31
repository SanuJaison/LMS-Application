import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { Institute } from '@/models/institute';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/institutes/:id
 *
 * Admin / manager only. `:id` accepts the Mongo id or the numeric legacy id.
 */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;

    await connectDB();

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
