import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Employee } from '@/models/employee';
import { EmployeeTask } from '@/models';
import { Lead } from '@/models/lead';
import {
  andFilter,
  canAccessEmployee,
  getScope,
  requireRoles,
  scopeFilter,
} from '@/lib/apiAuth';
import {
  parseTargetInput,
  resolveEmployeeTargets,
  syncEmployeeTargets,
} from '@/lib/targetSync';

export const dynamic = 'force-dynamic';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getIstDateRanges() {
  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const year = istNow.getUTCFullYear();
  const month = istNow.getUTCMonth();
  const day = istNow.getUTCDate();

  const startOfDay = new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - IST_OFFSET_MS);
  const endOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59, 999) - IST_OFFSET_MS);
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

function getLeadCompletionDate(lead: any): Date {
  if (lead.admission_date) return new Date(lead.admission_date);
  if (lead.updatedAt) return new Date(lead.updatedAt);
  if (lead.createdAt) return new Date(lead.createdAt);
  return new Date();
}

/**
 * GET /api/asm/bdes
 * Lists Business Development Executives (BDEs) visible to the caller,
 * including their daily_target, monthly_target, and achievement metrics.
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireRoles(req, ['ASM', 'BDM', 'SM', 'ADMIN', 'MD', 'BDE']);
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

    let bdes: any[] = await Employee.find(andFilter(...filters))
      .sort({ employee_id: 1 })
      .lean();

    if (bdes.length === 0 && auth.role === 'BDE') {
      const orBde: any[] = [{ employee_id: auth.employeeId }];
      if (auth.team) orBde.push({ team: auth.team });
      if (auth.employee?.reports_to) orBde.push({ reports_to: auth.employee.reports_to });
      bdes = await Employee.find(andFilter(baseFilter, { $or: orBde }))
        .sort({ employee_id: 1 })
        .lean();
    }

    const allEmployeeTasks: any[] = await EmployeeTask.find({})
      .sort({ createdAt: -1 })
      .lean();

    const leads = await Lead.find({
      employee_id: { $in: bdes.map((b) => b.employee_id).filter(Boolean) },
    })
      .select('employee_id status admission_status createdAt updatedAt admission_date')
      .lean();

    const { startOfDay, endOfDay, startOfMonth, endOfMonth } = getIstDateRanges();

    const data = bdes.map((bde) => {
      const myLeads = leads.filter((l: any) => l.employee_id === bde.employee_id);
      const totalLeads = myLeads.length;
      const completedLeads = myLeads.filter(isLeadCompleted);
      const admissions = completedLeads.length;
      const conversionRate =
        totalLeads > 0 ? Math.round((admissions / totalLeads) * 100) : 0;

      const { daily_target: assignedDaily, monthly_target: assignedMonthly } =
        resolveEmployeeTargets(bde, allEmployeeTasks);

      const dailyAchieved = completedLeads.filter((l: any) => {
        const d = getLeadCompletionDate(l);
        return d >= startOfDay && d <= endOfDay;
      }).length;
      const dailyPending = Math.max(0, assignedDaily - dailyAchieved);
      const dailyPercentage =
        assignedDaily > 0 ? Math.min(100, Math.round((dailyAchieved / assignedDaily) * 100)) : 0;

      const monthlyAchieved = completedLeads.filter((l: any) => {
        const d = getLeadCompletionDate(l);
        return d >= startOfMonth && d <= endOfMonth;
      }).length;
      const monthlyPending = Math.max(0, assignedMonthly - monthlyAchieved);
      const monthlyPercentage =
        assignedMonthly > 0
          ? Math.min(100, Math.round((monthlyAchieved / assignedMonthly) * 100))
          : 0;

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
        salary: bde.salary ?? 0,
        incentive: bde.incentive ?? 1000,
        bank_name: bde.bank_name || '',
        account_holder_name: bde.account_holder_name || '',
        account_number: bde.account_number || '',
        ifsc_code: bde.ifsc_code || '',
        upi_id: bde.upi_id || '',
        status: bde.status || 'active',
        total_leads: totalLeads,
        admissions,
        completed_leads: admissions,
        pending_leads: Math.max(0, totalLeads - admissions),
        conversion_rate: conversionRate,

        daily_target: assignedDaily,
        daily_achieved: dailyAchieved,
        daily_pending: dailyPending,
        daily_remaining: dailyPending,
        daily_completion_percentage: dailyPercentage,

        monthly_target: assignedMonthly,
        monthly_achieved: monthlyAchieved,
        monthly_pending: monthlyPending,
        monthly_remaining: monthlyPending,
        monthly_completion_percentage: monthlyPercentage,

        targets: {
          daily_target: assignedDaily,
          daily_achieved: dailyAchieved,
          daily_pending: dailyPending,
          daily_remaining: dailyPending,
          daily_percentage: dailyPercentage,
          monthly_target: assignedMonthly,
          monthly_achieved: monthlyAchieved,
          monthly_pending: monthlyPending,
          monthly_remaining: monthlyPending,
          monthly_percentage: monthlyPercentage,
          daily: {
            target: assignedDaily,
            total_leads: assignedDaily,
            completed_leads: dailyAchieved,
            achieved: dailyAchieved,
            pending_leads: dailyPending,
            remaining: dailyPending,
            completion_percentage: dailyPercentage,
          },
          monthly: {
            target: assignedMonthly,
            total_leads: assignedMonthly,
            completed_leads: monthlyAchieved,
            achieved: monthlyAchieved,
            pending_leads: monthlyPending,
            remaining: monthlyPending,
            completion_percentage: monthlyPercentage,
          },
        },
      };
    });

    // Single-BDE lookup:
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

export async function PUT(req: Request) {
  return updateBde(req);
}

export async function PATCH(req: Request) {
  return updateBde(req);
}

async function updateBde(req: Request) {
  try {
    await connectDB();

    const guard = await requireRoles(req, ['ASM', 'BDM', 'SM', 'ADMIN', 'MD']);
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));

    const targetId = String(
      searchParams.get('id') ||
        searchParams.get('employee_id') ||
        body.id ||
        body._id ||
        body.employee_id ||
        body.bde_id ||
        ''
    ).trim();

    if (!targetId) {
      return NextResponse.json(
        { success: false, message: 'BDE id or employee_id is required' },
        { status: 400 }
      );
    }

    const bde: any =
      (targetId.match(/^[0-9a-fA-F]{24}$/) ? await Employee.findById(targetId) : null) ||
      (await Employee.findOne({
        $or: [
          { employee_id: new RegExp(`^${targetId}$`, 'i') },
          { email: targetId.toLowerCase() },
        ],
      }));

    if (!bde) {
      return NextResponse.json(
        { success: false, message: `BDE "${targetId}" not found` },
        { status: 404 }
      );
    }

    const { dailyTarget, monthlyTarget, hasDaily, hasMonthly } = parseTargetInput(body);

    if (body.name !== undefined) bde.name = String(body.name).trim();
    if (body.email !== undefined) bde.email = String(body.email).trim().toLowerCase();
    if (body.contact_number !== undefined) bde.contact_number = String(body.contact_number).trim();
    if (body.salary !== undefined && !isNaN(Number(body.salary))) {
      bde.salary = Math.max(0, Number(body.salary));
    }
    if (body.incentive !== undefined && !isNaN(Number(body.incentive))) {
      bde.incentive = Math.max(0, Number(body.incentive));
    }
    if (hasDaily) bde.daily_target = dailyTarget;
    if (hasMonthly) bde.monthly_target = monthlyTarget;
    if (body.status !== undefined) bde.status = String(body.status).trim().toLowerCase();
    if (body.bank_name !== undefined) bde.bank_name = String(body.bank_name).trim();
    if (body.account_holder_name !== undefined) {
      bde.account_holder_name = String(body.account_holder_name).trim();
    }
    if (body.account_number !== undefined) {
      bde.account_number = String(body.account_number).trim();
    }
    if (body.ifsc_code !== undefined) {
      bde.ifsc_code = String(body.ifsc_code).trim().toUpperCase();
    }
    if (body.upi_id !== undefined) bde.upi_id = String(body.upi_id).trim();

    await bde.save();

    if (hasDaily || hasMonthly) {
      await syncEmployeeTargets(
        {
          employee_id: bde.employee_id,
          name: bde.name,
          designation: bde.designation,
        },
        hasDaily ? dailyTarget : undefined,
        hasMonthly ? monthlyTarget : undefined
      );
    }

    return NextResponse.json({
      success: true,
      message: `BDE ${bde.name} (${bde.employee_id}) updated successfully`,
      data: {
        id: bde._id.toString(),
        employee_id: bde.employee_id,
        name: bde.name,
        email: bde.email,
        contact_number: bde.contact_number,
        designation: bde.designation,
        team: bde.team,
        salary: bde.salary ?? 0,
        incentive: bde.incentive ?? 1000,
        daily_target: bde.daily_target ?? 0,
        monthly_target: bde.monthly_target ?? 0,
        status: bde.status,
      },
    });
  } catch (error: any) {
    console.error('PUT /api/asm/bdes error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update BDE' },
      { status: 500 }
    );
  }
}
