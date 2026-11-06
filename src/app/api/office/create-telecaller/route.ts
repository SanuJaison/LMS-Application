import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Employee } from '@/models/employee';
import { Team, Wallet } from '@/models';
import { requireRoles } from '@/lib/apiAuth';
import { logActivity, causerFromRequest } from '@/lib/activityLog';
import bcrypt from 'bcryptjs';

/**
 * POST /api/office/create-telecaller
 * Enables the Office Team Lead, Sales Manager (SM), or Admin to create a Telecaller under the Office Team.
 *
 * Rules:
 * - Telecaller is assigned under the Office Team Lead (or SM if no Office Lead exists).
 * - Designation: "Tele-caller".
 * - Team: "Office Team", Zone: "Central Zone".
 * - ID generated sequentially with prefix "TC" (TC001, TC002...).
 * - Creates employee wallet record.
 */
export async function POST(req: Request) {
  try {
    await connectDB();

    const guard = await requireRoles(req, ['ASM', 'BDM', 'SM', 'ADMIN', 'MD']);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const body = await req.json().catch(() => ({}));
    const { name, email, contact_number, password, district, salary: rawSalary, incentive: rawIncentive } = body;
    const salary = rawSalary !== undefined && !isNaN(Number(rawSalary)) ? Math.max(0, Number(rawSalary)) : 0;
    const incentive = rawIncentive !== undefined && !isNaN(Number(rawIncentive)) ? Math.max(0, Number(rawIncentive)) : 0;

    if (!name || !String(name).trim()) {
      return NextResponse.json(
        { success: false, message: 'Telecaller name is required' },
        { status: 400 }
      );
    }

    // Resolve the supervising Office Team Lead or SM
    let supervisor: any = null;

    if (
      String(auth.team || '').toLowerCase() === 'office team' ||
      String(auth.employee?.designation || '').toLowerCase().includes('office team lead')
    ) {
      supervisor = auth.employee;
    } else {
      // Find active Office Team Lead
      supervisor = await Employee.findOne({
        $or: [
          { designation: /office team lead/i },
          { team: /office team/i, designation: /manager|lead|asm/i },
          { team: /office team/i, employee_id: /^ASM/i },
        ],
        status: 'active',
      }).lean();

      // If no Office Team Lead yet, fallback to SM
      if (!supervisor) {
        supervisor = await Employee.findOne({
          $or: [
            { designation: /sales manager/i },
            { employee_id: /^SM/i },
          ],
          status: 'active',
        }).lean();
      }
    }

    const supervisorId = supervisor?.employee_id || 'SM001';
    const supervisorName = supervisor?.name || 'Office Lead';
    const teamName = 'Office Team';
    const zoneName = supervisor?.zone || 'Central Zone';
    const assignedDistrict = String(district || supervisor?.district || 'Ernakulam').trim();

    // Check unique identity
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

    // Generate next sequential TC ID (TC001, TC002...)
    const existingTCs = await Employee.find({
      employee_id: /^TC/i,
    })
      .select('employee_id')
      .lean();

    const usedNumbers = new Set<number>();
    existingTCs.forEach((emp: any) => {
      const match = String(emp.employee_id || '').match(/^TC(\d+)$/i);
      if (match && match[1]) {
        usedNumbers.add(parseInt(match[1], 10));
      }
    });

    let nextNum = 1;
    while (usedNumbers.has(nextNum)) nextNum += 1;
    const newTcId = `TC${String(nextNum).padStart(3, '0')}`;

    // Hash password
    const rawPassword = String(password || 'kide1234').trim();

    const newTelecaller = await Employee.create({
      employee_id: newTcId,
      name: trimmedName,
      email: (email || `${newTcId.toLowerCase()}@kide.com`).trim().toLowerCase(),
      contact_number: contact_number || '',
      password: rawPassword,
      designation: 'Tele-caller',
      zone: zoneName,
      district: assignedDistrict,
      team: teamName,
      reports_to: supervisorId,
      salary,
      incentive,
      status: 'active',
    });

    // Create wallet for new Telecaller
    await Wallet.create({
      employee: newTelecaller.name,
      employee_id: newTelecaller.employee_id,
      balance: 0,
      total_earned: 0,
      total_paid: 0,
      currency: 'INR',
    });

    // Increment Office Team member count
    await Team.findOneAndUpdate(
      { name: teamName },
      { $inc: { members_count: 1 }, $setOnInsert: { is_office: true, zone: zoneName } },
      { upsert: true }
    );

    await logActivity({
      description: `Office Team supervisor ${supervisorName} (${supervisorId}) created Tele-caller ${newTelecaller.name} (${newTelecaller.employee_id})`,
      subjectType: 'Employee',
      causer: causerFromRequest(req),
    });

    return NextResponse.json(
      {
        success: true,
        message: `Tele-caller ${newTelecaller.name} (${newTelecaller.employee_id}) created successfully under ${teamName}.`,
        data: {
          id: newTelecaller._id.toString(),
          employee_id: newTelecaller.employee_id,
          name: newTelecaller.name,
          designation: newTelecaller.designation,
          team: newTelecaller.team,
          district: newTelecaller.district,
          zone: newTelecaller.zone,
          reports_to: supervisorId,
          supervisor_name: supervisorName,
          salary: newTelecaller.salary ?? 0,
          incentive: newTelecaller.incentive ?? 0,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('POST /api/office/create-telecaller error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create telecaller' },
      { status: 500 }
    );
  }
}

function escapeRegex(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
