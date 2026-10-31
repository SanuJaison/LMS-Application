import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Zone } from '@/models/zone';

const DEFAULT_ZONES = [
  { name: 'South Zone', description: 'South Kerala regional zone (TVM, Kollam, Alappuzha, Pathanamthitta, Kottayam)' },
  { name: 'Central Zone', description: 'Central Kerala regional zone (Ernakulam, Idukki, Thrissur, Palakkad, Malappuram)' },
  { name: 'North Zone', description: 'North Kerala regional zone (Kozhikode, Wayanad, Kannur, Kasaragod)' },
];

/**
 * GET /api/zones - Fetch all zones
 */
export async function GET() {
  try {
    await connectDB();
    let zones = await Zone.find().sort({ name: 1 }).lean();

    // Auto-seed default Kerala zones if empty
    if (zones.length === 0) {
      await Zone.insertMany(DEFAULT_ZONES);
      zones = await Zone.find().sort({ name: 1 }).lean();
    }

    return NextResponse.json({ success: true, data: zones });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch zones' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/zones - Create a new zone
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
