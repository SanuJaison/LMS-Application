import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Employee } from '@/models/employee';
import { Team, Wallet } from '@/models';
import { requireRoles, getScope, canAccessEmployee } from '@/lib/apiAuth';
import { logActivity, causerFromRequest } from '@/lib/activityLog';
import bcrypt from 'bcryptjs';

/**
 * POST /api/asm/create-bde
 * Enables an Area Sales Manager (ASM) or Office Team Lead to create a
 * Business Development Executive (BDE) or Tele-caller.
 *
 * Rules:
 * - BDE / Tele-caller is automatically assigned under the creating ASM / Office Lead (reports_to = asm.employee_id).
 * - Inherits the ASM's team, zone, and district.
 * - If created by the Office Team Lead, designation defaults to "Tele-caller" and ID prefix is "TC".
 * - BDE / Tele-caller count is unlimited.
 * - Visible in ASM/Office side and Admin side.
 *
 * Authorization:
 * - ASM / BDM / Office Lead -> always creates under themselves; `asm_id` in the body is ignored.
 * - SM / admin -> may target an ASM / Office Lead via `asm_id` (SM only within its own subtree).
 */
export async function POST(req: Request) {
  try {
    await connectDB();

    const guard = await requireRoles(req, ['ASM', 'BDM', 'SM', 'ADMIN', 'MD']);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const body = await req.json().catch(() => ({}));
    const { name, email, contact_number, password, district, asm_id, designation } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json(
        { success: false, message: 'Name is required' },
        { status: 400 }
      );
    }

    // Resolve the owning ASM / Office Team Lead.
    let asmEmployee: any = null;

    if (auth.role === 'ASM' || auth.role === 'BDM') {
      // Never trust the body: an ASM / Office Lead only creates under itself.
      asmEmployee = auth.employee;
    } else {
      const requestedAsm = String(asm_id || body.asm_employee_id || '').trim();
      if (requestedAsm) {
        asmEmployee = await Employee.findOne({ employee_id: requestedAsm }).lean();
        if (!asmEmployee) {
          return NextResponse.json(
            {
              success: false,
              message: `Validation failed: Manager ${requestedAsm} not found.`,
            },
            { status: 400 }
          );
        }
        if (!auth.isAdmin && auth.role !== 'MD') {
          const scope = await getScope(auth);
          if (!canAccessEmployee(scope, asmEmployee.employee_id, asmEmployee.name)) {
            return NextResponse.json(
              {
                success: false,
                message: 'This manager is outside your hierarchy.',
              },
              { status: 403 }
            );
          }
        }
      } else if (auth.role === 'SM') {
        // An SM must name one of its own ASMs or the Office Lead.
        return NextResponse.json(
          {
            success: false,
            message:
              'Validation failed: asm_id is required. An SM creates subordinates under one of its ASMs or Office Lead.',
          },
          { status: 400 }
        );
      } else {
        asmEmployee = await Employee.findOne({
          $or: [
            { designation: /area sales manager/i },
            { designation: /office team lead/i },
            { employee_id: /^ASM/i },
          ],
        }).lean();
      }
    }

    if (!asmEmployee) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Validation failed: Creating manager not found. Please specify a valid Area Sales Manager or Office Team Lead.',
        },
        { status: 400 }
      );
    }

    const asmDesignation = String(asmEmployee.designation || '').toLowerCase();
    const asmIdValue = String(asmEmployee.employee_id || '').toUpperCase();
    const isOfficeLead =
      asmDesignation.includes('office team lead') ||
      String(asmEmployee.team || '').toLowerCase() === 'office team';
    const isRealAsm =
      asmIdValue.startsWith('ASM') ||
      asmDesignation.includes('area sales manager') ||
      isOfficeLead;

    if (!isRealAsm) {
      return NextResponse.json(
        {
          success: false,
          message: `Validation failed: ${asmEmployee.name} (${asmEmployee.employee_id}) is not an Area Sales Manager or Office Team Lead.`,
        },
        { status: 400 }
      );
    }

    // Identity must be unique.
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
          message: `An employee named "${duplicate.name}" (${duplicate.employee_id}) already exists.`,
        },
        { status: 400 }
      );
    }

    const assignedAsmId = asmEmployee.employee_id;
    const assignedAsmName = asmEmployee.name;
    const assignedTeam = asmEmployee.team || (isOfficeLead ? 'Office Team' : '');
    const assignedZone = asmEmployee.zone || 'Central Zone';

    // A BDE must sit in one of the districts owned by its ASM's team.
    // The Office Team covers central office / statewide operations without district locking.
    const teamDoc: any = assignedTeam
      ? await Team.findOne({
          name: new RegExp(`^${escapeRegex(assignedTeam)}$`, 'i'),
        }).lean()
      : null;
    const isOfficeTeam = isOfficeLead || teamDoc?.is_office || assignedTeam.toLowerCase() === 'office team';
    const teamDistricts: string[] = Array.isArray(teamDoc?.districts)
      ? teamDoc.districts.map((d: any) => String(d || '').trim()).filter(Boolean)
      : [];

    let assignedDistrict = String(district || '').trim();
    if (isOfficeTeam) {
      if (!assignedDistrict) {
        assignedDistrict = asmEmployee.district || 'Ernakulam';
      }
    } else {
      if (assignedDistrict && teamDistricts.length > 0) {
        const match = teamDistricts.find(
          (d) => d.toLowerCase() === assignedDistrict.toLowerCase()
        );
        if (!match) {
          return NextResponse.json(
            {
              success: false,
              message: `Validation failed: ${assignedDistrict} is not part of ${assignedTeam}. Allowed districts: ${teamDistricts.join(', ')}.`,
            },
            { status: 400 }
          );
        }
        assignedDistrict = match;
      }
      if (!assignedDistrict) {
        assignedDistrict = teamDistricts[0] || asmEmployee.district || 'Ernakulam';
      }
    }

    // Role / Designation handling
    const requestedDesignation = String(designation || '').trim();
    const isTelecaller =
      isOfficeTeam ||
      requestedDesignation.toLowerCase().includes('tele');
    const assignedDesignation =
      requestedDesignation || (isOfficeTeam ? 'Tele-caller' : 'Business Development Executive');

    // Generate next sequential ID: TC for telecallers, BDE for field executives
    const prefix = isTelecaller ? 'TC' : 'BDE';
    const existingEmployees = await Employee.find({
      employee_id: new RegExp(`^${prefix}`, 'i'),
    })
      .select('employee_id')
      .lean();

    const usedNumbers = new Set<number>();
    existingEmployees.forEach((emp: any) => {
      const match = String(emp.employee_id || '').match(new RegExp(`^${prefix}(\\d+)$`, 'i'));
      if (match && match[1]) {
        usedNumbers.add(parseInt(match[1], 10));
      }
    });

    let nextNum = 1;
    while (usedNumbers.has(nextNum)) nextNum += 1;
    const newEmpId = `${prefix}${String(nextNum).padStart(3, '0')}`;

    // Hash password
    const rawPassword = password || 'kide1234';
    const hashedPassword = bcrypt.hashSync(rawPassword, 10);

    const newEmployee = await Employee.create({
      employee_id: newEmpId,
      name: trimmedName,
      email: (email || `${newEmpId.toLowerCase()}@kide.com`).trim().toLowerCase(),
      contact_number: contact_number || '',
      password: hashedPassword,
      designation: assignedDesignation,
      zone: assignedZone,
      district: assignedDistrict,
      team: assignedTeam,
      reports_to: assignedAsmId,
      status: 'active',
    });

    // Create wallet for new employee
    await Wallet.create({
      employee: newEmployee.name,
      employee_id: newEmployee.employee_id,
      balance: 0,
      total_earned: 0,
      total_paid: 0,
      currency: 'INR',
    });

    // Increment team member count
    if (assignedTeam) {
      await Team.findOneAndUpdate(
        { name: assignedTeam },
        { $inc: { members_count: 1 } }
      );
    }

    await logActivity({
      description: `${isOfficeTeam ? 'Office Team Lead' : 'ASM'} ${assignedAsmName} (${assignedAsmId}) created ${assignedDesignation} ${newEmployee.name} (${newEmployee.employee_id}) under team ${assignedTeam}`,
      subjectType: 'Employee',
      causer: causerFromRequest(req),
    });

    return NextResponse.json(
      {
        success: true,
        message: `${assignedDesignation} ${newEmployee.name} (${newEmployee.employee_id}) created successfully under ${assignedAsmName} (${assignedTeam}).`,
        data: {
          id: newEmployee._id.toString(),
          employee_id: newEmployee.employee_id,
          name: newEmployee.name,
          designation: newEmployee.designation,
          team: newEmployee.team,
          district: newEmployee.district,
          zone: newEmployee.zone,
          reports_to: assignedAsmId,
          asm_name: assignedAsmName,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('POST /api/asm/create-bde error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create employee' },
      { status: 500 }
    );
  }
}

function escapeRegex(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
