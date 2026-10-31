import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Zone, District, Designation, Team } from '@/models';
import { numericId } from '@/lib/employeeAuth';

// Avoid build-time static caching of dropdown data on Vercel.
export const dynamic = 'force-dynamic';

/**
 * GET /api/hierarchy/filters
 * Returns combined dropdown options bundle for mobile hierarchy navigation.
 */
export async function GET() {
  try {
    await connectDB();

    const [zones, districts, designations, teams] = await Promise.all([
      Zone.find().lean(),
      District.find().lean(),
      Designation.find().lean(),
      Team.find().lean(),
    ]);

    const data = {
      zones: zones.map((z: any) => ({
        id: numericId(z._id) || z._id.toString(),
        name: z.name,
      })),
      districts: districts.map((d: any) => ({
        id: numericId(d._id) || d._id.toString(),
        name: d.name,
        zone: d.zone,
      })),
      designations: designations.map((des: any) => ({
        id: numericId(des._id) || des._id.toString(),
        name: des.name,
        prefix: des.prefix,
      })),
      teams: teams.map((t: any) => ({
        id: numericId(t._id) || t._id.toString(),
        name: t.name,
        district: t.district || (Array.isArray(t.districts) ? t.districts[0] : null),
        districts: t.districts || (t.district ? [t.district] : []),
        zone: t.zone,
        is_office: Boolean(t.is_office),
      })),
    };

    return NextResponse.json({
      success: true,
      message: 'Hierarchy filters loaded',
      data,
    });
  } catch (error: any) {
    console.error('GET /api/hierarchy/filters error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch hierarchy filters' },
      { status: 500 }
    );
  }
}
