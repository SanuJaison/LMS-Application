import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Employee } from '@/models/employee';
import { Wallet } from '@/models';
import { requireAdmin } from '@/lib/adminAuth';
import { logActivity, causerFromRequest } from '@/lib/activityLog';
import bcrypt from 'bcryptjs';

/**
 * Admin → create the single Sales Manager (SM).
 *
 * The master workflow is Admin → SM → ASM → BDE. The Admin creates exactly one
 * SM; that SM then creates the 7 regional ASMs plus the Office Team.
 * Admin can set monthly salary and incentive for the SM upon creation.
 *
 * GET  /api/admin/create-sm  -> whether the SM already exists
 * POST /api/admin/create-sm  -> create the SM (fails if one already exists)
 *
 * Both require a valid admin token (or x-admin-key).
 */

function isSmEmployee(employee: any): boolean {
  const id = String(employee?.employee_id || '').trim().toUpperCase();
  const designation = String(employee?.designation || '').trim().toLowerCase();
  if (designation.includes('area sales manager')) return false;
  return (
    id.startsWith('SM') ||
    designation.includes('sales manager') ||
    designation.includes('state manager')
  );
}

export async function GET(req: Request) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;

    await connectDB();

    const sm: any = await Employee.findOne({
      $or: [
        { designation: /sales manager/i },
        { designation: /state manager/i },
        { employee_id: /^SM/i },
      ],
      status: 'active',
    })
      .select('-password')
      .lean();

    return NextResponse.json({
      success: true,
      exists: Boolean(sm),
      data: sm
        ? {
            id: sm._id.toString(),
            employee_id: sm.employee_id,
            name: sm.name,
            email: sm.email || '',
            contact_number: sm.contact_number || '',
            designation: sm.designation || 'Sales Manager',
            salary: sm.salary ?? 0,
            incentive: sm.incentive ?? 0,
          }
        : null,
      message: sm
        ? 'A Sales Manager already exists. The organisation can have only one SM.'
        : 'No Sales Manager exists yet. Create one with POST /api/admin/create-sm.',
    });
  } catch (error: any) {
    console.error('GET /api/admin/create-sm error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to check SM' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;

    await connectDB();

    const body = await req.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const contactNumber = String(body.contact_number || body.phone || '').trim();
    const password = String(body.password || '').trim();
    const salary =
      body.salary !== undefined && !isNaN(Number(body.salary)) && Number(body.salary) > 0
        ? Math.max(0, Number(body.salary))
        : 5000;
    const incentive =
      body.incentive !== undefined && !isNaN(Number(body.incentive))
        ? Math.max(0, Number(body.incentive))
        : 0;

    if (!name) {
      return NextResponse.json(
        { success: false, message: 'Sales Manager name is required.' },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        {
          success: false,
          message: 'Password is required and must be at least 6 characters.',
        },
        { status: 400 }
      );
    }

    // Rule: the organisation has exactly one Sales Manager.
    const existingSm: any = await Employee.findOne({
      $or: [
        { designation: /sales manager/i },
        { designation: /state manager/i },
        { employee_id: /^SM/i },
      ],
      status: 'active',
    }).lean();

    if (existingSm) {
      return NextResponse.json(
        {
          success: false,
          message: `A Sales Manager already exists: ${existingSm.name} (${existingSm.employee_id}). Only one Sales Manager is allowed.`,
          data: {
            employee_id: existingSm.employee_id,
            name: existingSm.name,
          },
        },
        { status: 400 }
      );
    }

    // Rule: email must be unique if provided.
    const duplicate = email
      ? await Employee.findOne({ email }).lean()
      : null;

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          message: `Email "${email}" is already in use by ${duplicate.name} (${duplicate.employee_id}). Please use a different email.`,
        },
        { status: 400 }
      );
    }

    // Generate the next SM id (SM001, SM002, ...).
    const existingSms = await Employee.find({ employee_id: /^SM/i })
      .select('employee_id')
      .lean();
    const usedNumbers = new Set<number>();
    existingSms.forEach((emp: any) => {
      const match = String(emp.employee_id || '').match(/^SM(\d+)$/i);
      if (match && match[1]) usedNumbers.add(parseInt(match[1], 10));
    });
    let nextNum = 1;
    while (usedNumbers.has(nextNum)) nextNum += 1;
    const employeeId = `SM${String(nextNum).padStart(3, '0')}`;

    // Create SM employee and wallet
    const created: any = await Employee.create({
      employee_id: employeeId,
      name,
      email: email || `${employeeId.toLowerCase()}@kide.com`,
      contact_number: contactNumber,
      password,
      designation: 'Sales Manager',
      zone: 'Kerala',
      district: '',
      team: '',
      reports_to: '',
      salary,
      incentive,
      status: 'active',
    });

    await Wallet.create({
      employee: created.name,
      employee_id: created.employee_id,
      balance: 0,
      total_earned: 0,
      total_paid: 0,
      currency: 'INR',
    });

    await logActivity({
      description: `Admin created the Sales Manager ${created.name} (${created.employee_id}) with salary ₹${salary} and incentive ₹${incentive}`,
      subjectType: 'Employee',
      causer: causerFromRequest(req),
    });

    return NextResponse.json(
      {
        success: true,
        message: `Sales Manager ${created.name} (${created.employee_id}) created successfully.`,
        data: {
          id: created._id.toString(),
          employee_id: created.employee_id,
          name: created.name,
          email: created.email,
          contact_number: created.contact_number,
          designation: created.designation,
          salary: created.salary ?? 0,
          incentive: created.incentive ?? 0,
          reports_to: '',
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('POST /api/admin/create-sm error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create Sales Manager' },
      { status: 500 }
    );
  }
}

function escapeRegex(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
