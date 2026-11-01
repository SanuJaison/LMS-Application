import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Employee } from '@/models/employee';
import { Team } from '@/models';
import { logActivity, causerFromRequest } from '@/lib/activityLog';
import { requireRoles } from '@/lib/apiAuth';
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
  const code = String(value || '').trim().toUpperCase();
  if (code === 'KZE') return 'KZD';
  return code;
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
 *
 * Rules enforced here:
 * - The organisation has exactly one Sales Manager.
 * - At most 7 regional ASMs (one per team) + one Office Team lead.
 * - Each regional team owns exactly 2 districts.
 * - A district that is already assigned cannot be assigned to another team.
 * - A team can have only one ASM; an ASM can lead only one team.
 * - The Office Team covers no districts and can be created only once.
 */
export async function POST(req: Request) {
  try {
    await connectDB();

    const body = await req.json().catch(() => ({}));
    const { name, email, contact_number, password, team_code, custom_team_name } =
      body;

    if (!name || !String(name).trim()) {
      return NextResponse.json(
        { success: false, message: 'ASM name is required' },
        { status: 400 }
      );
    }

    // Only the Sales Manager creates ASMs (master workflow: Admin → SM → ASM).
    // Admin creates the single SM via POST /api/admin/create-sm and can view
    // every ASM through GET /api/sm/asms, but does not assign teams.
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
    const normalizedCode = normalizeTeamCode(team_code);
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
      if (existingOffice || existingOfficeLead) {
        return NextResponse.json(
          {
            success: false,
            message:
              'The Office Team already exists. Only one Office Team can be created.',
          },
          { status: 400 }
        );
      }
    }

    // Rule: A team can have only one ASM. The Teams collection is the source of
    // truth for the current lead (the employee.team field can be stale).
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

    // Rule: A district can belong to only one team. The Teams collection is the
    // source of truth; create-asm always writes the districts there.
    if (assignedDistricts.length > 0) {
      const takenBy = new Map<string, string>();

      const teams: any[] = await Team.find({}).lean();
      for (const team of teams) {
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
        ...(normalizedEmail
          ? [{ email: normalizedEmail }]
          : []),
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

    const rawPassword = password || 'kide1234';
    const hashedPassword = bcrypt.hashSync(rawPassword, 10);

    const newAsm = await Employee.create({
      employee_id: newAsmId,
      name: trimmedName,
      email: (email || `${newAsmId.toLowerCase()}@kide.com`).trim().toLowerCase(),
      contact_number: contact_number || '',
      password: hashedPassword,
      designation: isOffice ? 'Office Team Lead' : 'Area Sales Manager',
      zone: assignedZone,
      district: assignedDistricts[0] || '',
      team: assignedTeamName,
      reports_to: smId,
      status: 'active',
    });

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

    await logActivity({
      description: `Sales Manager ${smName} created Area Sales Manager ${newAsm.name} (${newAsm.employee_id}) for ${assignedTeamName}`,
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
          designation: newAsm.designation,
          team: newAsm.team,
          districts: assignedDistricts,
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
