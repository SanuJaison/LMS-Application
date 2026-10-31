import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Employee } from '@/models/employee';
import { Lead } from '@/models/lead';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';
import { hierarchyRole } from '@/lib/hierarchy';

/**
 * GET /api/asm/bdes
 * Lists Business Development Executives (BDEs).
 * - If called by an ASM: returns BDEs under their team.
 * - If called by Admin/SM: returns all BDEs with their assigned ASMs and performance stats.
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const token = extractTokenFromHeader(req);
    const decoded = token ? verifyToken(token) : null;
    const { searchParams } = new URL(req.url);

    const query: Record<string, any> = {
      $or: [
        { designation: /business development executive/i },
        { employee_id: /^BDE/i },
      ],
    };

    if (decoded?.role === 'employee' && decoded.id) {
      const me: any = await Employee.findById(decoded.id).lean();
      if (me) {
        const role = hierarchyRole(me);
        if (role === 'ASM') {
          query.$and = [{ $or: [{ reports_to: me.employee_id }, { team: me.team }] }];
        }
      }
    }

    const asmId = searchParams.get('asm_id');
    if (asmId) query.reports_to = asmId;

    const team = searchParams.get('team');
    if (team) query.team = team;

    // Single-BDE lookup identifiers (Mongo id, employee_id or email).
    const wantedId = (searchParams.get('id') || searchParams.get('_id') || '').trim();
    const wantedEmployeeId = (searchParams.get('employee_id') || '').trim();
    const wantedEmail = (searchParams.get('email') || '').trim();

    const bdes: any[] = await Employee.find(query)
      .sort({ employee_id: 1 })
      .lean();

    // Fetch leads summary for each BDE
    const leads = await Lead.find({
      employee_id: { $in: bdes.map((b) => b.employee_id).filter(Boolean) },
    })
      .select('employee_id status admission_status')
      .lean();

    const data = bdes.map((bde) => {
      const myLeads = leads.filter((l: any) => l.employee_id === bde.employee_id);
      const totalLeads = myLeads.length;
      const admissions = myLeads.filter(
        (l: any) =>
          l.admission_status === 'Admitted' ||
          l.admission_status === 'Closed' ||
          l.status === 4 ||
          l.status === 5
      ).length;
      const conversionRate =
        totalLeads > 0 ? Math.round((admissions / totalLeads) * 100) : 0;

      return {
        id: bde._id.toString(),
        employee_id: bde.employee_id,
        name: bde.name,
        email: bde.email,
        contact_number: bde.contact_number,
        designation: bde.designation,
        team: bde.team,
        district: bde.district,
        zone: bde.zone,
        reports_to: bde.reports_to,
        status: bde.status || 'active',
        total_leads: totalLeads,
        admissions,
        conversion_rate: conversionRate,
      };
    });

    // Single-BDE lookup:
    //   /api/asm/bdes?id=<mongo id>  |  ?employee_id=BDE001  |  ?email=...
    if (wantedId || wantedEmployeeId || wantedEmail) {
      const one = data.find((bde) => {
        const matchesId =
          wantedId &&
          (String(bde.id).toLowerCase() === wantedId.toLowerCase() ||
            String(bde.employee_id || '').toLowerCase() === wantedId.toLowerCase() ||
            String(bde.email || '').toLowerCase() === wantedId.toLowerCase());
        const matchesEmployeeId =
          wantedEmployeeId &&
          String(bde.employee_id || '').toLowerCase() === wantedEmployeeId.toLowerCase();
        const matchesEmail =
          wantedEmail &&
          String(bde.email || '').toLowerCase() === wantedEmail.toLowerCase();
        return Boolean(matchesId || matchesEmployeeId || matchesEmail);
      });

      if (!one) {
        return NextResponse.json(
          {
            success: false,
            message: `BDE ${wantedId || wantedEmployeeId || wantedEmail} not found.`,
          },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: one });
    }

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error: any) {
    console.error('GET /api/asm/bdes error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to list BDEs' },
      { status: 500 }
    );
  }
}
