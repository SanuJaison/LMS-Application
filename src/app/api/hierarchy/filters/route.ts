import { connectDB } from '@/lib/db';
import { Designation, District, Team, Zone } from '@/models';
import { ok } from '@/lib/employeeAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/hierarchy/filters
 * Dropdown values for the mobile filters (zones, districts, designations, teams).
 */
export async function GET() {
  try {
    await connectDB();

    const [zones, districts, designations, teams] = await Promise.all([
      Zone.find().sort({ name: 1 }).lean(),
      District.find().sort({ name: 1 }).lean(),
      Designation.find().sort({ name: 1 }).lean(),
      Team.find().sort({ name: 1 }).lean(),
    ]);

    return ok(
      {
        zones: (zones as any[]).map((z) => ({ id: z._id?.toString(), name: z.name })),
        districts: (districts as any[]).map((d) => ({
          id: d._id?.toString(),
          name: d.name,
          zone: d.zone || null,
        })),
        designations: (designations as any[]).map((d) => ({
          id: d._id?.toString(),
          name: d.name,
          prefix: d.prefix || null,
        })),
        teams: (teams as any[]).map((t) => ({
          id: t._id?.toString(),
          name: t.name,
          district: t.district || null,
          // `districts` is the source of truth; `district` is kept for older clients.
          districts:
            Array.isArray(t.districts) && t.districts.length
              ? t.districts
              : t.district
                ? [t.district]
                : [],
          zone: t.zone || null,
        })),
      },
      'Hierarchy filters fetched successfully'
    );
  } catch (error: any) {
    console.error('GET /api/hierarchy/filters error:', error);
    return ok({ zones: [], districts: [], designations: [], teams: [] }, 'Filters unavailable');
  }
}
