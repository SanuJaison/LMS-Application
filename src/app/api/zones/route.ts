import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Zone } from '@/models/zone';

/**
 * GET /api/zones - Fetch all zones from database
 */
export async function GET() {
  try {
    await connectDB();
    const zones = await Zone.find().sort({ name: 1 }).lean();
    return NextResponse.json({ success: true, data: zones });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch zones' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/zones - Create a new zone in database
 */
export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();

    if (!body.name) {
      return NextResponse.json(
        { success: false, message: 'Zone name is required' },
        { status: 400 }
      );
    }

    const zone = await Zone.create({
      name: body.name.trim(),
      description: body.description || '',
    });

    return NextResponse.json({ success: true, data: zone }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create zone' },
      { status: 500 }
    );
  }
}
