import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Lead } from '@/models/lead';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';
import { assignLegacyIds, resolveEmployeeAssignment } from '@/lib/mobileLead';
import { normalizeLeadPayload, validateLeadPayload } from '@/lib/leadPayload';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/leads/create
 *
 * Admin-side lead creation. Unlike /api/leads/create (used by the employee
 * app), the assigned employee is REQUIRED and must be chosen explicitly,
 * because an admin creates leads on behalf of someone else.
 *
 * Body: identical to /api/leads/create plus:
 *   "employee": "Aslam"   (name)  or
 *   "employee_id": "BDE001"       (either one is enough)
 */
export async function POST(req: Request) {
  try {
    await connectDB();

    // Employees must use /api/leads/create, which assigns them automatically
    const token = extractTokenFromHeader(req);
    const decoded = token ? verifyToken(token) : null;
    if (decoded?.role === 'employee') {
      return NextResponse.json(
        {
          success: false,
          message: 'Employees cannot use this endpoint. Use /api/leads/create instead.',
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON request body. Please provide lead data.' },
        { status: 400 }
      );
    }

    const validationError = validateLeadPayload(body);
    if (validationError) {
      return NextResponse.json({ success: false, message: validationError }, { status: 400 });
    }

    // Assigned employee is mandatory on the admin side
    const rawEmployee = String(body.employee || body.employee_id || '').trim();
    if (!rawEmployee) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Validation failed: Assigned employee is required (send "employee": "Aslam" or "employee_id": "BDE001").',
        },
        { status: 400 }
      );
    }

    const assignment = await resolveEmployeeAssignment({
      employee: body.employee,
      employee_id: body.employee_id,
    });

    if (!assignment.employee_id) {
      return NextResponse.json(
        {
          success: false,
          message: `Assigned employee "${rawEmployee}" was not found. Send a valid employee name or employee ID (e.g. BDE001).`,
        },
        { status: 400 }
      );
    }

    const payload = normalizeLeadPayload(body);
    payload.employee = assignment.employee;
    payload.employee_id = assignment.employee_id;

    await assignLegacyIds([payload as any]);
    const created = await Lead.create(payload);

    return NextResponse.json(
      {
        success: true,
        message: `Lead ${created.name} (${created.lead_id}) created and assigned to ${assignment.employee} (${assignment.employee_id})`,
        data: { ...created.toObject(), id: created._id.toString() },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('POST /api/admin/leads/create error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create lead' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/leads/create
 * Field guide for the admin-side creation endpoint.
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message:
      'Admin lead creation endpoint. POST here with an assigned employee. Employees should use /api/leads/create.',
    endpoint: '/api/admin/leads/create',
    method: 'POST',
    required_fields: ['name', 'phone', 'employee (or employee_id)'],
    optional_fields: [
      'whatsapp_number',
      'email',
      'address',
      'place',
      'district',
      'age',
      'qualification',
      'college_name',
      'current_year',
      'interested_topic',
      'interested_course',
      'lead_source',
      'admission_status',
      'notes',
    ],
    sample_post_payload: {
      name: 'Rahul Krishna',
      phone: '9847123456',
      whatsapp_number: '9847123456',
      email: 'rahul@gmail.com',
      address: 'MG Road',
      place: 'Edappally, Kochi',
      district: 'Ernakulam',
      age: 22,
      qualification: 'B.Tech Computer Science',
      college_name: 'Model Engineering College',
      current_year: 'Final Year',
      interested_topic: 'MERN Stack & Next.js',
      interested_course: 'Full-Stack Web Development',
      lead_source: 'Campus Drive / College Seminar',
      admission_status: 'New',
      employee_id: 'BDE001',
      notes: 'Interested in weekend batch',
    },
  });
}
