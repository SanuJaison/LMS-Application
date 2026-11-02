import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Employee } from '@/models/employee';
import { Lead } from '@/models/lead';
import {
  andFilter,
  canAccessEmployee,
  getScope,
  requireRoles,
  scopeFilter,
} from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/asm/bdes
 * Lists Business Development Executives (BDEs) visible to the caller.
 *   - ASM / BDM -> only BDEs that report to them
 *   - SM        -> all BDEs in their subtree
 *   - admin     -> all
 *
 * BDE tokens get 403: a BDE can no longer enumerate other BDEs.
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireRoles(req, ['ASM', 'BDM', 'SM', 'ADMIN', 'MD']);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const scope = await getScope(auth);
    const { searchParams } = new URL(req.url);

    const baseFilter = {
      $or: [
        { designation: /business development executive/i },
        { designation: /tele-caller/i },
        { designation: /telecaller/i },
        { employee_id: /^BDE/i },
        { employee_id: /^TC/i },
      ],
    };

    const visibility =
      auth.isAdmin || auth.role === 'MD'
        ? {}
        : scopeFilter(scope, { idFields: ['employee_id'] });

    const filters: Record<string, any>[] = [baseFilter, visibility];

    // ASM / BDM: strictly their own direct reports.
    if (auth.role === 'ASM' || auth.role === 'BDM') {
      filters.push({ reports_to: auth.employeeId });
    }

    const asmId = (searchParams.get('asm_id') || '').trim();
    if (asmId) {
      if (auth.role === 'ASM' || auth.role === 'BDM') {
        if (asmId !== auth.employeeId) {
          return NextResponse.json(
            { success: false, message: 'You can only list your own BDEs.' },
            { status: 403 }
          );
        }
      } else if (!auth.isAdmin && auth.role !== 'MD') {
        if (!canAccessEmployee(scope, asmId)) {
          return NextResponse.json(
            { success: false, message: 'This ASM is outside your hierarchy.' },
            { status: 403 }
          );
        }
      }
      filters.push({ reports_to: asmId });
    }

    const team = (searchParams.get('team') || '').trim();
    if (team) {
      if (
        !auth.isAdmin &&
        auth.role !== 'MD' &&
        auth.role !== 'SM' &&
        team.toLowerCase() !== auth.team.toLowerCase()
      ) {
        return NextResponse.json(
          { success: false, message: 'You can only list your own team.' },
          { status: 403 }
        );
      }
      filters.push({ team });
    }

    const wantedId = (searchParams.get('id') || searchParams.get('_id') || '').trim();
    const wantedEmployeeId = (searchParams.get('employee_id') || '').trim();
    const wantedEmail = (searchParams.get('email') || '').trim();

    const bdes: any[] = await Employee.find(andFilter(...filters))
      .sort({ employee_id: 1 })
      .lean();

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
