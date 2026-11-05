import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Team } from '@/models';
import { requireRoles } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireRoles(req, ['SM', 'MD', 'ADMIN']);
    if (!guard.ok) return guard.response;

    const predefined = [
      { team_name: 'TVM', district: 'Thiruvananthapuram, Kollam' },
      { team_name: 'PTM', district: 'Pathanamthitta, Alappuzha' },
      { team_name: 'KTM', district: 'Kottayam, Idukki' },
      { team_name: 'EKM', district: 'Ernakulam, Thrissur' },
      { team_name: 'PKD', district: 'Palakkad, Malappuram' },
      { team_name: 'CLT', district: 'Kozhikode, Wayanad' },
      { team_name: 'KZD', district: 'Kannur, Kasaragod' },
      { team_name: 'Office Team', district: 'Office' },
    ];

    let teamsList = predefined;
    try {
      const dbTeams = (await Team.find({}).sort({ is_office: 1, name: 1 }).lean()) as any[];
      if (dbTeams && dbTeams.length > 0) {
        teamsList = dbTeams.map((t: any) => {
          const rawDistricts = Array.isArray(t.districts) && t.districts.length > 0
            ? t.districts
            : t.district ? [t.district] : [];
          const codeMatch = String(t.name || '').trim().match(/^([A-Z]{3})/i);
          const teamName = t.is_office ? 'Office Team' : (codeMatch ? codeMatch[1].toUpperCase() : t.name);
          const districtStr = t.is_office ? 'Office' : rawDistricts.join(', ');
          return {
            team_name: teamName,
            district: districtStr,
          };
        });
        const sortOrder = ['TVM', 'PTM', 'KTM', 'EKM', 'PKD', 'CLT', 'KZD', 'Office Team'];
        teamsList.sort((a, b) => {
          const idxA = sortOrder.indexOf(a.team_name);
          const idxB = sortOrder.indexOf(b.team_name);
          return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
        });
      }
    } catch {
      // Fall back to predefined list
    }

    return NextResponse.json({
      success: true,
      teams: teamsList,
      data: teamsList,
    });
  } catch (error: any) {
    console.error('GET /api/sm/teams error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch SM teams' },
      { status: 500 }
    );
  }
}
