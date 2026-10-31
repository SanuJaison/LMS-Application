import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Institute } from '@/models/institute';
import { numericId } from '@/lib/employeeAuth';

/**
 * GET /api/institutes - List institutes
 * POST /api/institutes - Create institute
 */
export async function GET(req: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);

    const district = searchParams.get('district');
    const search = searchParams.get('search');

    const query: Record<string, any> = {};
    if (district) query.district = district;
    if (search) {
      query.name = new RegExp(search.trim(), 'i');
    }

    const institutes = await Institute.find(query).sort({ name: 1 }).lean();

    const data = institutes.map((inst: any) => ({
      id: numericId(inst._id) || inst._id.toString(),
      _id: inst._id.toString(),
      name: inst.name,
      type: inst.type || 'College',
      district: inst.district,
      address: inst.address || '',
      contact_person: inst.contact_person || '',
      contact_phone: inst.contact_phone || '',
      email: inst.email || '',
    }));

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('GET /api/institutes error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch institutes' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json().catch(() => ({}));

    if (!body.name || !String(body.name).trim()) {
      return NextResponse.json(
        { success: false, message: 'Institute name is required' },
        { status: 400 }
      );
    }

    const institute = await Institute.create({
      name: String(body.name).trim(),
      type: body.type || 'College',
      district: body.district || 'Ernakulam',
      address: body.address || '',
      contact_person: body.contact_person || '',
      contact_phone: body.contact_phone || '',
      email: body.email || '',
    });

    return NextResponse.json(
      {
        success: true,
        message: `Institute ${institute.name} created successfully`,
        data: {
          id: numericId(institute._id) || institute._id.toString(),
          _id: institute._id.toString(),
          name: institute.name,
          district: institute.district,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('POST /api/institutes error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create institute' },
      { status: 500 }
    );
  }
}
