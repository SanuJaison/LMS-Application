import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Employee } from '@/models/employee';
import { Team, EmployeeTask } from '@/models';
import { Lead } from '@/models/lead';
import { andFilter, getScope, requireRoles, scopeFilter } from '@/lib/apiAuth';
import {
  parseTargetInput,
  resolveEmployeeTargets,
  rolloverDailyTargetsIfNeeded,
  syncEmployeeTargets,
} from '@/lib/targetSync';

// Always read fresh data: Next.js 14 otherwise statically caches this GET at
// build time, so newly created ASMs never show up on Vercel.
export const dynamic = 'force-dynamic';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getIstDateRanges() {
  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);

  const year = istNow.getUTCFullYear();
  const month = istNow.getUTCMonth();
  const day = istNow.getUTCDate();

  // Start & end of today in IST
  const startOfDay = new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - IST_OFFSET_MS);
  const endOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59, 999) - IST_OFFSET_MS);

  // Start & end of current month in IST
  const startOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0) - IST_OFFSET_MS);
  const endOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999) - IST_OFFSET_MS);

  return { startOfDay, endOfDay, startOfMonth, endOfMonth };
}

function isLeadCompleted(lead: any): boolean {
  const status = lead.status;
  const statusStr = String(status || '').toLowerCase().trim();
  const admStatus = String(lead.admission_status || '').toLowerCase().trim();
  return (
    status === 4 ||
    status === 5 ||
    statusStr === '4' ||
    statusStr === '5' ||
    statusStr === 'admitted' ||
    statusStr === 'closed' ||
    statusStr === 'won' ||
    admStatus === 'admitted' ||
    admStatus === 'closed' ||
    admStatus === 'won'
  );
}

function getLeadCreationDate(lead: any): Date {
  if (lead.createdAt) return new Date(lead.createdAt);
  if (lead._id && typeof lead._id.getTimestamp === 'function') {
    return lead._id.getTimestamp();
  }
  return new Date();
}

function getLeadCompletionDate(lead: any): Date {
  if (lead.admission_date) return new Date(lead.admission_date);
  if (lead.updatedAt) return new Date(lead.updatedAt);
  return getLeadCreationDate(lead);
}

/**
 * GET /api/sm/asms
 * Lists the Area Sales Managers (ASMs) visible to the caller, along with
 * their daily, monthly, and overall lead targets & achievement metrics.
 *   - SM    -> only ASMs that report to that SM
 *   - admin -> all ASMs
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireRoles(req, ['SM', 'ADMIN', 'MD', 'ASM', 'BDM', 'BDE']);
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

    await rolloverDailyTargetsIfNeeded();

    let asms: any[] = await Employee.find(andFilter(asmFilter, visibility))
      .sort({ employee_id: 1 })
      .lean();

    if (asms.length === 0 && (auth.role === 'ASM' || auth.role === 'BDE')) {
      asms = await Employee.find(asmFilter)
        .sort({ employee_id: 1 })
        .lean();
    }

    const teams = await Team.find().lean();
    const allEmployeeTasks: any[] = await EmployeeTask.find({})
      .sort({ createdAt: -1 })
      .lean();
    const bdes = await Employee.find({
      $or: [
        { designation: /business development executive/i },
        { employee_id: /^BDE/i },
      ],
    })
      .select('employee_id name reports_to team status')
      .lean();

    // Fetch leads to calculate daily and monthly achievements
    const allLeads: any[] = await Lead.find({})
      .select(
        'asm_id asm_name team employee employee_id admission_status status createdAt updatedAt admission_date'
      )
      .lean();

    const { startOfDay, endOfDay, startOfMonth, endOfMonth } = getIstDateRanges();

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

      const bdeIds = new Set(
        assignedBdes.map((b: any) => String(b.employee_id || '').toLowerCase()).filter(Boolean)
      );
      const bdeNames = new Set(
        assignedBdes.map((b: any) => String(b.name || '').toLowerCase().trim()).filter(Boolean)
      );
      const asmIdLower = String(asm.employee_id || '').toLowerCase();
      const asmNameLower = String(asm.name || '').toLowerCase().trim();
      const asmTeamLower = String(asm.team || teamDoc?.name || '').toLowerCase().trim();

      // Find all leads associated with this ASM or their BDEs
      const asmLeads = allLeads.filter((l: any) => {
        const leadAsmId = String(l.asm_id || '').toLowerCase();
        if (leadAsmId && leadAsmId === asmIdLower) return true;

        const leadTeam = String(l.team || '').toLowerCase().trim();
        if (asmTeamLower && leadTeam && leadTeam === asmTeamLower) return true;

        const leadEmpId = String(l.employee_id || '').toLowerCase();
        if (leadEmpId && (leadEmpId === asmIdLower || bdeIds.has(leadEmpId))) return true;

        const leadEmpName = String(l.employee || '').toLowerCase().trim();
        if (leadEmpName && (leadEmpName === asmNameLower || bdeNames.has(leadEmpName))) return true;

        return false;
      });

      // Overall leads
      const overallTotal = asmLeads.length;
      const overallCompleted = asmLeads.filter(isLeadCompleted).length;
      const overallPending = Math.max(0, overallTotal - overallCompleted);
      const overallPercentage =
        overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0;

      // Resolve assigned daily and monthly targets from EmployeeTask / Employee
      const { daily_target: assignedDaily, monthly_target: assignedMonthly } =
        resolveEmployeeTargets(asm, allEmployeeTasks);

      // Daily leads closed (IST today)
      const dailyCompleted = asmLeads.filter((l: any) => {
        if (!isLeadCompleted(l)) return false;
        const d = getLeadCompletionDate(l);
        return d >= startOfDay && d <= endOfDay;
      });

      const dailyTotal = assignedDaily;
      const dailyAchieved = dailyCompleted.length;
      const dailyPending = Math.max(0, dailyTotal - dailyAchieved);
      const dailyPercentage =
        dailyTotal > 0 ? Math.min(100, Math.round((dailyAchieved / dailyTotal) * 100)) : 0;

      // Monthly leads closed (IST current month)
      const monthlyCompleted = asmLeads.filter((l: any) => {
        if (!isLeadCompleted(l)) return false;
        const d = getLeadCompletionDate(l);
        return d >= startOfMonth && d <= endOfMonth;
      });

      const monthlyTotal = assignedMonthly;
      const monthlyAchieved = monthlyCompleted.length;
      const monthlyPending = Math.max(0, monthlyTotal - monthlyAchieved);
      const monthlyPercentage =
        monthlyTotal > 0 ? Math.min(100, Math.round((monthlyAchieved / monthlyTotal) * 100)) : 0;

      return {
        id: asm._id.toString(),
        employee_id: asm.employee_id,
        name: asm.name,
        email: asm.email,
        contact_number: asm.contact_number,
        designation: asm.designation,
        team: asm.team || teamDoc?.name || '',
        district: asm.district || (teamDoc?.districts?.[0]) || '',
        districts: teamDoc?.districts || (asm.district ? [asm.district] : []),
        zone: asm.zone || teamDoc?.zone || '',
        reports_to: asm.reports_to || '',
        salary: asm.salary ?? 0,
        incentive: asm.incentive ?? 0,
        bank_name: asm.bank_name || '',
        account_holder_name: asm.account_holder_name || '',
        account_number: asm.account_number || '',
        ifsc_code: asm.ifsc_code || '',
        upi_id: asm.upi_id || '',
        bdes_count: assignedBdes.length,
        status: asm.status || 'active',

        // Flat target fields for simple access
        daily_target: dailyTotal,
        daily_achieved: dailyAchieved,
        daily_pending: dailyPending,
        daily_remaining: dailyPending,
        daily_completion_percentage: dailyPercentage,

        monthly_target: monthlyTotal,
        monthly_achieved: monthlyAchieved,
        monthly_pending: monthlyPending,
        monthly_remaining: monthlyPending,
        monthly_completion_percentage: monthlyPercentage,

        total_leads: overallTotal,
        completed_leads: overallCompleted,
        pending_leads: overallPending,
        completion_percentage: overallPercentage,

        // Structured targets breakdown
        targets: {
          daily_target: dailyTotal,
          daily_achieved: dailyAchieved,
          daily_pending: dailyPending,
          daily_remaining: dailyPending,
          daily_percentage: dailyPercentage,
          monthly_target: monthlyTotal,
          monthly_achieved: monthlyAchieved,
          monthly_pending: monthlyPending,
          monthly_remaining: monthlyPending,
          monthly_percentage: monthlyPercentage,
          daily: {
            target: dailyTotal,
            total_leads: dailyTotal,
            completed_leads: dailyAchieved,
            achieved: dailyAchieved,
            pending_leads: dailyPending,
            remaining: dailyPending,
            completion_percentage: dailyPercentage,
          },
          monthly: {
            target: monthlyTotal,
            total_leads: monthlyTotal,
            completed_leads: monthlyAchieved,
            achieved: monthlyAchieved,
            pending_leads: monthlyPending,
            remaining: monthlyPending,
            completion_percentage: monthlyPercentage,
          },
          overall: {
            total_leads: overallTotal,
            completed_leads: overallCompleted,
            pending_leads: overallPending,
            completion_percentage: overallPercentage,
          },
        },
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

/**
 * PUT / PATCH /api/sm/asms
 * Updates an ASM's details, salary, incentive, daily_target, and monthly_target.
 */
export async function PUT(req: Request) {
  return updateAsm(req);
}

export async function PATCH(req: Request) {
  return updateAsm(req);
}

async function updateAsm(req: Request) {
  try {
    await connectDB();

    const guard = await requireRoles(req, ['SM', 'ADMIN', 'MD']);
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));

    const targetId = String(
      searchParams.get('id') ||
        searchParams.get('employee_id') ||
        body.id ||
        body._id ||
        body.employee_id ||
        body.asm_id ||
        ''
    ).trim();

    if (!targetId) {
      return NextResponse.json(
        { success: false, message: 'ASM id or employee_id is required' },
        { status: 400 }
      );
    }

    const asm: any =
      (targetId.match(/^[0-9a-fA-F]{24}$/) ? await Employee.findById(targetId) : null) ||
      (await Employee.findOne({
        $or: [
          { employee_id: new RegExp(`^${targetId}$`, 'i') },
          { email: targetId.toLowerCase() },
        ],
      }));

    if (!asm) {
      return NextResponse.json(
        { success: false, message: `ASM "${targetId}" not found` },
        { status: 404 }
      );
    }

    const { dailyTarget, monthlyTarget, hasDaily, hasMonthly } = parseTargetInput(body);

    if (body.name !== undefined) asm.name = String(body.name).trim();
    if (body.email !== undefined) asm.email = String(body.email).trim().toLowerCase();
    if (body.contact_number !== undefined) asm.contact_number = String(body.contact_number).trim();
    if (body.salary !== undefined && !isNaN(Number(body.salary))) {
      asm.salary = Math.max(0, Number(body.salary));
    }
    if (body.incentive !== undefined && !isNaN(Number(body.incentive))) {
      asm.incentive = Math.max(0, Number(body.incentive));
    }
    if (body.status !== undefined) asm.status = String(body.status).trim().toLowerCase();
    if (body.bank_name !== undefined) asm.bank_name = String(body.bank_name).trim();
    if (body.account_holder_name !== undefined) {
      asm.account_holder_name = String(body.account_holder_name).trim();
    }
    if (body.account_number !== undefined) {
      asm.account_number = String(body.account_number).trim();
    }
    if (body.ifsc_code !== undefined) {
      asm.ifsc_code = String(body.ifsc_code).trim().toUpperCase();
    }
    if (body.upi_id !== undefined) asm.upi_id = String(body.upi_id).trim();

    await asm.save();

    if (hasDaily || hasMonthly) {
      const synced = await syncEmployeeTargets(
        {
          employee_id: asm.employee_id,
          name: asm.name,
          designation: asm.designation,
        },
        hasDaily ? dailyTarget : undefined,
        hasMonthly ? monthlyTarget : undefined
      );
      asm.daily_target = synced.daily_target;
      asm.monthly_target = synced.monthly_target;
    }

    return NextResponse.json({
      success: true,
      message: `ASM ${asm.name} (${asm.employee_id}) updated successfully`,
      data: {
        id: asm._id.toString(),
        employee_id: asm.employee_id,
        name: asm.name,
        email: asm.email,
        contact_number: asm.contact_number,
        designation: asm.designation,
        team: asm.team,
        salary: asm.salary ?? 0,
        incentive: asm.incentive ?? 0,
        daily_target: asm.daily_target ?? 0,
        monthly_target: asm.monthly_target ?? 0,
        status: asm.status,
      },
    });
  } catch (error: any) {
    console.error('PUT /api/sm/asms error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update ASM' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const { handleDeleteAccount } = await import('@/lib/deleteAccount');
  return handleDeleteAccount(req);
}
