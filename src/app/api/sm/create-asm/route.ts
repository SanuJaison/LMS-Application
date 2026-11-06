import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Employee } from '@/models/employee';
import { Team, Wallet } from '@/models';
import { logActivity, causerFromRequest } from '@/lib/activityLog';
import { requireAuth, requireRoles } from '@/lib/apiAuth';
import { parseTargetInput, syncEmployeeTargets } from '@/lib/targetSync';
import bcrypt from 'bcryptjs';

/**
 * The seven regional teams and their fixed districts (master workflow §5.2).
 * `KZD` is the canonical code for team 7 (Kannur + Kasaragod); `KZE` is kept
 * as an accepted alias so older clients keep working, but both resolve to the
 * same team and the same two districts.
 */
const REGIONAL_TEAMS_CONFIG: Record<
  string,
  { teamName: string; districts: [string, string]; zone: string }
> = {
  TVM: {
    teamName: 'TVM Team',
    districts: ['Thiruvananthapuram', 'Kollam'],
    zone: 'South Zone',
  },
  PTM: {
    teamName: 'PTM Team',
    districts: ['Pathanamthitta', 'Alappuzha'],
    zone: 'South Zone',
  },
  KTM: {
    teamName: 'KTM Team',
    districts: ['Kottayam', 'Idukki'],
    zone: 'Central Zone',
  },
  EKM: {
    teamName: 'EKM Team',
    districts: ['Ernakulam', 'Thrissur'],
    zone: 'Central Zone',
  },
  PKD: {
    teamName: 'PKD Team',
    districts: ['Palakkad', 'Malappuram'],
    zone: 'Central Zone',
  },
  CLT: {
    teamName: 'CLT Team',
    districts: ['Kozhikode', 'Wayanad'],
    zone: 'North Zone',
  },
  KZD: {
    teamName: 'KZD Team',
    districts: ['Kannur', 'Kasaragod'],
    zone: 'North Zone',
  },
};

/** Accept KZE as an alias for KZD (team 7). */
function normalizeTeamCode(value: string): string {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'KZE') return 'KZD';
  if (raw.startsWith('OFFICE')) return 'OFFICE';
  const match = raw.match(/^([A-Z]{3})/);
  if (match && REGIONAL_TEAMS_CONFIG[match[1]]) return match[1];
  return raw;
}

function isAsm(employee: any): boolean {
  const id = String(employee?.employee_id || '').trim().toUpperCase();
  const designation = String(employee?.designation || '').trim().toLowerCase();
  return id.startsWith('ASM') || designation.includes('area sales manager');
}

function isSm(employee: any): boolean {
  const id = String(employee?.employee_id || '').trim().toUpperCase();
  const designation = String(employee?.designation || '').trim().toLowerCase();
  if (designation.includes('area sales manager')) return false;
  return (
    id.startsWith('SM') ||
    designation.includes('sales manager') ||
    designation.includes('state manager')
  );
}

function normalizeDistrict(value: string): string {
  return String(value || '').trim().toLowerCase();
}

/** Team leads are stored as "Name (EMPID)" or just "Name". */
function parseTeamLead(teamLead: string): { name: string; employeeId: string } {
  const raw = String(teamLead || '').trim();
  const match = raw.match(/^(.*?)\s*\((.*?)\)\s*$/);
  if (match) return { name: match[1].trim(), employeeId: match[2].trim() };
  return { name: raw, employeeId: '' };
}

/**
 * POST /api/sm/create-asm
 * Enables the Sales Manager (SM) to create an Area Sales Manager (ASM) for one
 * of the seven regional teams, or the single Office Team (no districts).
 * The SM can set monthly salary, incentive, daily_target, and monthly_target for the ASM.
 */
export async function POST(req: Request) {
  try {
    await connectDB();

    const body = await req.json().catch(() => ({}));
    const {
      name,
      email,
      contact_number,
      password,
      team_code,
      custom_team_name,
      salary: rawSalary,
      incentive: rawIncentive,
      bank_name,
      account_holder_name,
      account_number,
      ifsc_code,
      upi_id,
    } = body;

    const salary =
      rawSalary !== undefined && !isNaN(Number(rawSalary)) && Number(rawSalary) > 0
        ? Math.max(0, Number(rawSalary))
        : 5000;
    const incentive =
      rawIncentive !== undefined && !isNaN(Number(rawIncentive))
        ? Math.max(0, Number(rawIncentive))
        : 0;

    const { dailyTarget, monthlyTarget, hasDaily, hasMonthly } = parseTargetInput(body);

    if (!name || !String(name).trim()) {
      return NextResponse.json(
        { success: false, message: 'ASM name is required' },
        { status: 400 }
      );
    }

    // Only the Sales Manager creates ASMs (master workflow: Admin → SM → ASM).
    const guard = await requireRoles(req, ['SM', 'MD']);
    if (!guard.ok) return guard.response;
    const { auth } = guard;

    // Resolve the owning SM. An SM always creates ASMs under themselves; an
    // admin may target a specific SM with sm_id / sm_employee_id.
    let smEmployee: any = auth.employee;
    if (!smEmployee) {
      const requestedSm = String(body.sm_id || body.sm_employee_id || '').trim();
      smEmployee = requestedSm
        ? await Employee.findOne({ employee_id: requestedSm }).lean()
        : await Employee.findOne({
            $or: [
              { designation: /sales manager/i },
              { designation: /state manager/i },
              { employee_id: /^SM/i },
            ],
            status: 'active',
          }).lean();
    }

    if (!smEmployee || !isSm(smEmployee)) {
      return NextResponse.json(
        {
          success: false,
          message:
            'No Sales Manager found. Admin must create the single SM first (POST /api/admin/create-sm).',
        },
        { status: 400 }
      );
    }

    const smId = smEmployee.employee_id;
    const smName = smEmployee.name || 'Sales Manager';

    // Normalize team code (TVM, PTM, KTM, EKM, PKD, CLT, KZD / KZE, OFFICE).
    const rawTeam = team_code || body.team_name || body.team || '';
    const normalizedCode = normalizeTeamCode(rawTeam);
    const isOffice = normalizedCode === 'OFFICE';
    const teamConfig = REGIONAL_TEAMS_CONFIG[normalizedCode];

    if (!teamConfig && !isOffice) {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid team selection "${team_code}". Allowed teams are: TVM, PTM, KTM, EKM, PKD, CLT, KZD (KZE accepted as an alias) or OFFICE.`,
        },
        { status: 400 }
      );
    }

    const assignedTeamName = isOffice
      ? 'Office Team'
      : custom_team_name || teamConfig.teamName;
    const assignedDistricts: string[] = isOffice ? [] : teamConfig.districts;
    const assignedZone = isOffice ? 'Central Zone' : teamConfig.zone;

    // Rule: The Office Team can exist only once.
    if (isOffice) {
      const existingOffice = await Team.findOne({ is_office: true }).lean();
      const existingOfficeLead = await Employee.findOne({
        $or: [
          { team: 'Office Team' },
          { designation: /office team lead/i },
        ],
        status: 'active',
      }).lean();
      if (existingOfficeLead) {
        return NextResponse.json(
          {
            success: false,
            message:
              'The Office Team already has an assigned lead. Only one Office Team Lead can be created.',
          },
          { status: 400 }
        );
      }
    }

    // Rule: A team can have only one ASM.
    const existingTeamDoc: any = await Team.findOne({
      name: new RegExp(`^${escapeRegex(assignedTeamName)}$`, 'i'),
    }).lean();

    if (existingTeamDoc && String(existingTeamDoc.team_lead || '').trim()) {
      const lead = parseTeamLead(existingTeamDoc.team_lead);
      const leadEmployee: any = lead.employeeId
        ? await Employee.findOne({ employee_id: lead.employeeId }).lean()
        : lead.name
          ? await Employee.findOne({
              name: new RegExp(`^${escapeRegex(lead.name)}$`, 'i'),
            }).lean()
          : null;

      if (leadEmployee && leadEmployee.status !== 'inactive') {
        return NextResponse.json(
          {
            success: false,
            message: `Team "${assignedTeamName}" is already assigned to Area Sales Manager ${
              leadEmployee?.name || lead.name || existingTeamDoc.team_lead
            }${
              lead.employeeId ? ` (${lead.employeeId})` : ''
            }. An ASM team can only have one assigned ASM.`,
          },
          { status: 400 }
        );
      }
    }

    // Rule: A district can belong to only one team.
    if (assignedDistricts.length > 0) {
      const takenBy = new Map<string, string>();

      const teams: any[] = await Team.find({}).lean();
      for (const team of teams) {
        // Exclude the current team itself! A team can own its own districts.
        const isSameTeam =
          (team.name && assignedTeamName && team.name.trim().toLowerCase() === assignedTeamName.trim().toLowerCase()) ||
          (team.name && normalizedCode && team.name.trim().toUpperCase().startsWith(normalizedCode));

        if (isSameTeam) continue;

        const districts = [
          ...(Array.isArray(team.districts) ? team.districts : []),
          team.district || '',
        ];
        for (const district of districts) {
          const key = normalizeDistrict(district);
          if (key) takenBy.set(key, team.name || 'another team');
        }
      }

      for (const district of assignedDistricts) {
        const owner = takenBy.get(normalizeDistrict(district));
        if (owner) {
          return NextResponse.json(
            {
              success: false,
              message: `${district} is already assigned to "${owner}". A district can belong to only one team.`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Rule: Count total active regional ASMs (max 7).
    if (!isOffice) {
      const activeAsmCount = await Employee.countDocuments({
        $or: [
          { designation: /area sales manager/i },
          { employee_id: /^ASM/i },
        ],
        status: 'active',
      });

      if (activeAsmCount >= 7) {
        return NextResponse.json(
          {
            success: false,
            message:
              'Maximum limit reached: All 7 regional ASM positions have already been filled.',
          },
          { status: 400 }
        );
      }
    }

    // Rule: An ASM can lead only one team. Reject a duplicate identity.
    const trimmedName = String(name).trim();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const duplicate = await Employee.findOne({
      $or: [
        { name: new RegExp(`^${escapeRegex(trimmedName)}$`, 'i') },
        ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
      ],
    }).lean();
    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          message: `An employee named "${duplicate.name}" (${duplicate.employee_id}) already exists. An ASM can only be assigned once.`,
        },
        { status: 400 }
      );
    }

    // Generate next sequential ASM ID (ASM001, ASM002...).
    const existingAsms = await Employee.find({ employee_id: /^ASM/i })
      .select('employee_id')
      .lean();

    const usedNumbers = new Set<number>();
    existingAsms.forEach((emp: any) => {
      const match = String(emp.employee_id || '').match(/^ASM(\d+)$/i);
      if (match && match[1]) {
        usedNumbers.add(parseInt(match[1], 10));
      }
    });

    let nextNum = 1;
    while (usedNumbers.has(nextNum)) nextNum += 1;
    const newAsmId = `ASM${String(nextNum).padStart(3, '0')}`;

    const rawPassword = String(password || 'kide1234').trim();

    const newAsm = await Employee.create({
      employee_id: newAsmId,
      name: trimmedName,
      email: (email || `${newAsmId.toLowerCase()}@kide.com`).trim().toLowerCase(),
      contact_number: contact_number || '',
      password: rawPassword,
      designation: isOffice ? 'Office Team Lead' : 'Area Sales Manager',
      zone: assignedZone,
      district: assignedDistricts[0] || '',
      team: assignedTeamName,
      reports_to: smId,
      salary,
      incentive,
      daily_target: dailyTarget,
      monthly_target: monthlyTarget,
      bank_name: String(bank_name || '').trim(),
      account_holder_name: String(account_holder_name || '').trim(),
      account_number: String(account_number || '').trim(),
      ifsc_code: String(ifsc_code || '').trim().toUpperCase(),
      upi_id: String(upi_id || '').trim(),
      status: 'active',
    });

    // Also sync daily and monthly targets into EmployeeTask so Employee Tasks & Home API see them
    if (hasDaily || hasMonthly) {
      await syncEmployeeTargets(
        {
          employee_id: newAsm.employee_id,
          name: newAsm.name,
          designation: newAsm.designation,
        },
        hasDaily ? dailyTarget : undefined,
        hasMonthly ? monthlyTarget : undefined
      );
    }

    // Create or update the Team document.
    await Team.findOneAndUpdate(
      { name: assignedTeamName },
      {
        $set: {
          name: assignedTeamName,
          districts: assignedDistricts,
          district: assignedDistricts[0] || '',
          zone: assignedZone,
          team_lead: `${newAsm.name} (${newAsm.employee_id})`,
          is_office: isOffice,
          description: `${assignedTeamName} managing ${
            assignedDistricts.join(', ') || 'Office operations'
          }`,
        },
      },
      { upsert: true, new: true }
    );

    // Initialize wallet for new ASM
    await Wallet.create({
      employee: newAsm.name,
      employee_id: newAsm.employee_id,
      balance: 0,
      total_earned: 0,
      total_paid: 0,
      currency: 'INR',
    });

    await logActivity({
      description: `Sales Manager ${smName} created Area Sales Manager ${newAsm.name} (${newAsm.employee_id}) for ${assignedTeamName} with salary ₹${salary}, incentive ₹${incentive}, daily target ${dailyTarget}, monthly target ${monthlyTarget}`,
      subjectType: 'Employee',
      causer: causerFromRequest(req),
    });

    return NextResponse.json(
      {
        success: true,
        message: `Area Sales Manager ${newAsm.name} (${newAsm.employee_id}) created successfully for ${assignedTeamName}. Assigned districts: ${
          assignedDistricts.join(', ') || 'None (Office)'
        }`,
        data: {
          id: newAsm._id.toString(),
          employee_id: newAsm.employee_id,
          name: newAsm.name,
          email: newAsm.email,
          contact_number: newAsm.contact_number,
          designation: newAsm.designation,
          team: newAsm.team,
          districts: assignedDistricts,
          salary: newAsm.salary ?? 0,
          incentive: newAsm.incentive ?? 0,
          daily_target: dailyTarget,
          monthly_target: monthlyTarget,
          targets: {
            daily_target: dailyTarget,
            monthly_target: monthlyTarget,
            daily: {
              total_leads: dailyTarget,
              completed_leads: 0,
              pending_leads: dailyTarget,
              completion_percentage: 0,
            },
            monthly: {
              total_leads: monthlyTarget,
              completed_leads: 0,
              pending_leads: monthlyTarget,
              completion_percentage: 0,
            },
          },
          reports_to: smId,
          sm_name: smName,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('POST /api/sm/create-asm error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create ASM' },
      { status: 500 }
    );
  }
}

function escapeRegex(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * GET /api/sm/create-asm
 * Returns the 8 predefined teams (7 regional + 1 office) with their fixed
 * districts, zones, and whether each team is currently available or already assigned.
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;

    const asms: any[] = await Employee.find({
      $or: [
        { designation: /area sales manager/i },
        { designation: /office team lead/i },
        { employee_id: /^ASM/i },
      ],
      status: 'active',
    })
      .select('name employee_id team district')
      .lean();

    const data: Array<{
      team_code: string;
      team_name: string;
      districts: string[];
      zone: string;
      is_available: boolean;
      assigned_to: { employee_id: string; name: string } | null;
    }> = Object.entries(REGIONAL_TEAMS_CONFIG).map(([code, cfg]) => {
      const assigned = asms.find(
        (a) => a.team?.toLowerCase() === cfg.teamName.toLowerCase()
      );
      return {
        team_code: code,
        team_name: cfg.teamName,
        districts: cfg.districts,
        zone: cfg.zone,
        is_available: !assigned,
        assigned_to: assigned
          ? {
              employee_id: assigned.employee_id,
              name: assigned.name,
            }
          : null,
      };
    });

    const officeAssigned = asms.find(
      (a) =>
        a.team?.toLowerCase() === 'office team' ||
        /office team lead/i.test(a.designation)
    );

    data.push({
      team_code: 'OFFICE',
      team_name: 'Office Team',
      districts: [],
      zone: 'Central Zone',
      is_available: !officeAssigned,
      assigned_to: officeAssigned
        ? {
            employee_id: officeAssigned.employee_id,
            name: officeAssigned.name,
          }
        : null,
    });

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error: any) {
    console.error('GET /api/sm/create-asm error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to list predefined teams' },
      { status: 500 }
    );
  }
}
