import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Employee } from '@/models/employee';
import { Team } from '@/models';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';
import { logActivity, causerFromRequest } from '@/lib/activityLog';
import bcrypt from 'bcryptjs';

// Predefined 7 Regional Teams and their fixed 2 districts
export const REGIONAL_TEAMS_CONFIG: Record<
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
  KZE: {
    teamName: 'KZE Team',
    districts: ['Kannur', 'Kasaragod'],
    zone: 'North Zone',
  },
  KZD: {
    teamName: 'KZE Team',
    districts: ['Kannur', 'Kasaragod'],
    zone: 'North Zone',
  },
};

/**
 * POST /api/sm/create-asm
 * Enables the Sales Manager (SM) to create an Area Sales Manager (ASM).
 *
 * Rules:
 * - Only 1 SM in the organization.
 * - Exactly 7 regional ASM teams.
 * - Each ASM has 2 assigned districts.
 * - Once assigned, a district cannot be chosen again by another team.
 * - Once an ASM is assigned with a team, that ASM cannot have another team.
 */
export async function POST(req: Request) {
  try {
    await connectDB();

    const body = await req.json().catch(() => ({}));
    const { name, email, contact_number, password, team_code, custom_team_name } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json(
        { success: false, message: 'ASM name is required' },
        { status: 400 }
      );
    }

    // Resolve SM (Sales Manager)
    const token = extractTokenFromHeader(req);
    const decoded = token ? verifyToken(token) : null;
    let smEmployee: any = null;

    if (decoded?.role === 'employee' && decoded.id) {
      smEmployee = await Employee.findById(decoded.id).lean();
    }
    if (!smEmployee) {
      smEmployee = await Employee.findOne({
        $or: [
          { designation: /sales manager/i },
          { designation: /state manager/i },
          { employee_id: /^SM/i },
        ],
      }).lean();
    }

    const smId = smEmployee?.employee_id || 'SM001';
    const smName = smEmployee?.name || 'Sales Manager';

    // Normalize team code (e.g. TVM, PTM, KTM, EKM, PKD, CLT, KZE / KZD)
    const normalizedCode = String(team_code || '').trim().toUpperCase();
    const teamConfig = REGIONAL_TEAMS_CONFIG[normalizedCode];

    if (!teamConfig && normalizedCode !== 'OFFICE') {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid team selection "${team_code}". Allowed regional teams are: TVM, PTM, KTM, EKM, PKD, CLT, KZE (or OFFICE).`,
        },
        { status: 400 }
      );
    }

    const assignedTeamName =
      normalizedCode === 'OFFICE'
        ? 'Office Team'
        : custom_team_name || teamConfig.teamName;
    const assignedDistricts =
      normalizedCode === 'OFFICE' ? [] : teamConfig.districts;
    const assignedZone =
      normalizedCode === 'OFFICE' ? 'Central Zone' : teamConfig.zone;

    // Rule: Once a team has an ASM, another ASM cannot be assigned to that same team
    const existingTeamLeader = await Employee.findOne({
      team: assignedTeamName,
      $or: [
        { designation: /area sales manager/i },
        { employee_id: /^ASM/i },
      ],
      status: 'active',
    });

    if (existingTeamLeader) {
      return NextResponse.json(
        {
          success: false,
          message: `Team "${assignedTeamName}" is already assigned to Area Sales Manager ${existingTeamLeader.name} (${existingTeamLeader.employee_id}). An ASM team can only have one assigned ASM.`,
        },
        { status: 400 }
      );
    }

    // Rule: Count total active ASMs (max 7 regional ASMs)
    if (normalizedCode !== 'OFFICE') {
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

    // Generate next sequential ASM ID (ASM001, ASM002...)
    const existingAsms = await Employee.find({
      employee_id: /^ASM/i,
    })
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

    // Hash password
    const rawPassword = password || 'kide1234';
    const hashedPassword = bcrypt.hashSync(rawPassword, 10);

    const newAsm = await Employee.create({
      employee_id: newAsmId,
      name: name.trim(),
      email: (email || `${newAsmId.toLowerCase()}@kide.com`).trim().toLowerCase(),
      contact_number: contact_number || '',
      password: hashedPassword,
      designation:
        normalizedCode === 'OFFICE'
          ? 'Office Team Lead'
          : 'Area Sales Manager',
      zone: assignedZone,
      district: assignedDistricts[0] || '',
      team: assignedTeamName,
      reports_to: smId,
      status: 'active',
    });

    // Update or create Team document
    await Team.findOneAndUpdate(
      { name: assignedTeamName },
      {
        $set: {
          name: assignedTeamName,
          districts: assignedDistricts,
          district: assignedDistricts[0] || '',
          zone: assignedZone,
          team_lead: `${newAsm.name} (${newAsm.employee_id})`,
          is_office: normalizedCode === 'OFFICE',
          description: `${assignedTeamName} managing ${assignedDistricts.join(', ') || 'Office operations'}`,
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
        message: `Area Sales Manager ${newAsm.name} (${newAsm.employee_id}) created successfully for ${assignedTeamName}. Assigned districts: ${assignedDistricts.join(', ') || 'None (Office)'}`,
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
