import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Zone, District, Designation, Team } from '@/models';
import { numericId } from '@/lib/employeeAuth';
import { requireAuth } from '@/lib/apiAuth';
import { getAsmTeamAndDistricts } from '@/lib/hierarchy';

// Avoid build-time static caching of dropdown data on Vercel.
export const dynamic = 'force-dynamic';

/**
 * GET /api/hierarchy/filters
 * Returns combined dropdown options bundle for mobile hierarchy navigation.
 * When called by an ASM, districts and teams are scoped to that ASM's own team (2 districts).
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;
    const { auth } = guard;

    const [zones, districts, designations, teams] = await Promise.all([
      Zone.find().lean(),
      District.find().lean(),
      Designation.find().lean(),
      Team.find().lean(),
    ]);

    let filteredDistricts: any[] = districts as any[];
    let filteredTeams: any[] = teams as any[];

    if ((auth.role === 'ASM' || auth.role === 'BDM') && auth.employee) {
      const { teamName, districts: allowedDistricts, isOffice } =
        await getAsmTeamAndDistricts(auth.employee);
      if (!isOffice && allowedDistricts.length > 0) {
        const allowedSet = new Set(allowedDistricts.map((d) => d.toLowerCase()));
        filteredDistricts = filteredDistricts.filter((d: any) =>
          allowedSet.has(String(d.name || '').trim().toLowerCase())
        );
      }
      if (teamName) {
        filteredTeams = filteredTeams.filter(
          (t: any) => String(t.name || '').trim().toLowerCase() === teamName.trim().toLowerCase()
        );
      }
    }

    const data = {
      zones: zones.map((z: any) => ({
        id: numericId(z._id) || z._id.toString(),
        name: z.name,
      })),
      districts: filteredDistricts.map((d: any) => ({
        id: numericId(d._id) || d._id.toString(),
        name: d.name,
        zone: d.zone,
      })),
      designations: designations.map((des: any) => ({
        id: numericId(des._id) || des._id.toString(),
        name: des.name,
        prefix: des.prefix,
      })),
      teams: filteredTeams.map((t: any) => ({
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
