import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Employee } from '@/models/employee';
import { Team, Wallet } from '@/models';
import { requireRoles, getScope, canAccessEmployee } from '@/lib/apiAuth';
import { logActivity, causerFromRequest } from '@/lib/activityLog';
import bcrypt from 'bcryptjs';

/**
 * POST /api/asm/create-bde
 * Enables an Area Sales Manager (ASM) to create a Business Development Executive (BDE).
 *
 * Rules:
 * - BDE is automatically assigned under the creating ASM (reports_to = asm.employee_id).
 * - Inherits the ASM's team, zone, and district.
 * - BDE count is unlimited.
 * - Visible in both ASM side and Admin side.
 *
 * Authorization:
 * - ASM / BDM -> always creates under themselves; `asm_id` in the body is ignored.
 * - SM / admin -> may target an ASM via `asm_id` (SM only within its own subtree).
 */
export async function POST(req: Request) {
  try {
    await connectDB();

    const guard = await requireRoles(req, ['ASM', 'BDM', 'SM', 'ADMIN', 'MD']);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const body = await req.json().catch(() => ({}));
    const { name, email, contact_number, password, district, asm_id } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json(
        { success: false, message: 'BDE name is required' },
        { status: 400 }
      );
    }

    // Resolve the owning ASM.
    let asmEmployee: any = null;

    if (auth.role === 'ASM' || auth.role === 'BDM') {
      // Never trust the body: an ASM only creates BDEs under itself.
      asmEmployee = auth.employee;
    } else {
      const requestedAsm = String(asm_id || body.asm_employee_id || '').trim();
      if (requestedAsm) {
        asmEmployee = await Employee.findOne({ employee_id: requestedAsm }).lean();
        if (!asmEmployee) {
          return NextResponse.json(
            {
              success: false,
              message: `Validation failed: ASM ${requestedAsm} not found.`,
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
                message: 'This ASM is outside your hierarchy.',
              },
              { status: 403 }
            );
          }
        }
      } else if (auth.role === 'SM') {
        // An SM must name one of its own ASMs.
        return NextResponse.json(
          {
            success: false,
            message:
              'Validation failed: asm_id is required. An SM creates BDEs under one of its ASMs.',
          },
          { status: 400 }
        );
      } else {
        asmEmployee = await Employee.findOne({
          $or: [
            { designation: /area sales manager/i },
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
            'Validation failed: Creating ASM not found. Please specify a valid Area Sales Manager.',
        },
        { status: 400 }
      );
    }

    const assignedAsmId = asmEmployee.employee_id;
    const assignedAsmName = asmEmployee.name;
    const assignedTeam = asmEmployee.team || '';
    const assignedZone = asmEmployee.zone || 'Central Zone';
    const assignedDistrict = district || asmEmployee.district || 'Ernakulam';

    // Generate next sequential BDE ID (BDE001, BDE002...)
    const existingBdes = await Employee.find({
      employee_id: /^BDE/i,
    })
      .select('employee_id')
      .lean();

    const usedNumbers = new Set<number>();
    existingBdes.forEach((emp: any) => {
      const match = String(emp.employee_id || '').match(/^BDE(\d+)$/i);
      if (match && match[1]) {
        usedNumbers.add(parseInt(match[1], 10));
      }
    });

    let nextNum = 1;
    while (usedNumbers.has(nextNum)) nextNum += 1;
    const newBdeId = `BDE${String(nextNum).padStart(3, '0')}`;

    // Hash password
    const rawPassword = password || 'kide1234';
    const hashedPassword = bcrypt.hashSync(rawPassword, 10);

    const newBde = await Employee.create({
      employee_id: newBdeId,
      name: name.trim(),
      email: (email || `${newBdeId.toLowerCase()}@kide.com`).trim().toLowerCase(),
      contact_number: contact_number || '',
      password: hashedPassword,
      designation: 'Business Development Executive',
      zone: assignedZone,
      district: assignedDistrict,
      team: assignedTeam,
      reports_to: assignedAsmId,
      status: 'active',
    });

    // Create wallet for new BDE
    await Wallet.create({
      employee: newBde.name,
      employee_id: newBde.employee_id,
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
      description: `ASM ${assignedAsmName} (${assignedAsmId}) created BDE ${newBde.name} (${newBde.employee_id}) under team ${assignedTeam}`,
      subjectType: 'Employee',
      causer: causerFromRequest(req),
    });

    return NextResponse.json(
      {
        success: true,
        message: `Business Development Executive ${newBde.name} (${newBde.employee_id}) created successfully under ASM ${assignedAsmName} (${assignedTeam}).`,
        data: {
          id: newBde._id.toString(),
          employee_id: newBde.employee_id,
          name: newBde.name,
          designation: newBde.designation,
          team: newBde.team,
          district: newBde.district,
          zone: newBde.zone,
          reports_to: assignedAsmId,
          asm_name: assignedAsmName,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('POST /api/asm/create-bde error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create BDE' },
      { status: 500 }
    );
  }
}
