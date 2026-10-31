import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Employee } from '@/models/employee';
import { Team } from '@/models';
import { andFilter, getScope, requireRoles, scopeFilter } from '@/lib/apiAuth';

// Always read fresh data: Next.js 14 otherwise statically caches this GET at
// build time, so newly created ASMs never show up on Vercel.
export const dynamic = 'force-dynamic';

/**
 * GET /api/sm/asms
 * Lists the Area Sales Managers (ASMs) visible to the caller.
 *   - SM    -> only ASMs that report to that SM
 *   - admin -> all ASMs
 *
 * Requires an SM or admin token. BDE/ASM tokens get 403.
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireRoles(req, ['SM', 'ADMIN', 'MD']);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const { searchParams } = new URL(req.url);
    const wantedId = (searchParams.get('id') || searchParams.get('_id') || '').trim();
    const wantedEmployeeId = (
      searchParams.get('employee_id') ||
      searchParams.get('asm_id') ||
      ''
    ).trim();
    const wantedEmail = (searchParams.get('email') || '').trim();

    const asmFilter = {
      $or: [
        { designation: /area sales manager/i },
        { employee_id: /^ASM/i },
        { designation: /office team lead/i },
      ],
    };

    // An SM only sees ASMs in their own reporting line. Never team-wide.
    const scope = await getScope(auth);
    const visibility =
      auth.isAdmin || auth.role === 'MD'
        ? {}
        : scopeFilter(scope, { idFields: ['employee_id'] });

    const asms: any[] = await Employee.find(andFilter(asmFilter, visibility))
      .sort({ employee_id: 1 })
      .lean();

    const teams = await Team.find().lean();
    const bdes = await Employee.find({
      $or: [
        { designation: /business development executive/i },
        { employee_id: /^BDE/i },
      ],
    })
      .select('employee_id name reports_to team status')
      .lean();

    const data = asms.map((asm) => {
      const teamDoc: any = teams.find(
        (t) =>
          t.name?.toLowerCase() === asm.team?.toLowerCase() ||
          t.team_lead?.toLowerCase().includes(asm.name.toLowerCase())
      );

      // Count only BDEs that explicitly report to this ASM (not the whole team).
      const assignedBdes = bdes.filter(
        (b: any) => String(b.reports_to || '') === String(asm.employee_id || '')
      );

      return {
        id: asm._id.toString(),
        employee_id: asm.employee_id,
        name: asm.name,
        email: asm.email,
        contact_number: asm.contact_number,
        designation: asm.designation,
        team: asm.team || teamDoc?.name || '',
        districts: teamDoc?.districts || (asm.district ? [asm.district] : []),
        zone: asm.zone || teamDoc?.zone || '',
        reports_to: asm.reports_to || '',
        bdes_count: assignedBdes.length,
        status: asm.status || 'active',
      };
    });

    // Single-ASM lookup:
    //   /api/sm/asms?id=<mongo id>  |  ?employee_id=ASM001  |  ?email=...
    if (wantedId || wantedEmployeeId || wantedEmail) {
      const one = data.find((asm) => {
        const matchesId =
          wantedId &&
          (String(asm.id).toLowerCase() === wantedId.toLowerCase() ||
            String(asm.employee_id || '').toLowerCase() === wantedId.toLowerCase() ||
            String(asm.email || '').toLowerCase() === wantedId.toLowerCase());
        const matchesEmployeeId =
          wantedEmployeeId &&
          String(asm.employee_id || '').toLowerCase() === wantedEmployeeId.toLowerCase();
        const matchesEmail =
          wantedEmail &&
          String(asm.email || '').toLowerCase() === wantedEmail.toLowerCase();
        return Boolean(matchesId || matchesEmployeeId || matchesEmail);
      });

      if (!one) {
        return NextResponse.json(
          {
            success: false,
            message: `ASM ${wantedId || wantedEmployeeId || wantedEmail} not found.`,
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
    console.error('GET /api/sm/asms error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to list ASMs' },
      { status: 500 }
    );
  }
}
