import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Lead } from '@/models/lead';
import { Employee } from '@/models/employee';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';
import {
  assignLegacyIds,
  resolveEmployeeAssignment,
  serializeLeadsForMobile,
} from '@/lib/mobileLead';
import { normalizeLeadPayload } from '@/lib/leadPayload';
import { getNextStudentId } from '@/lib/studentId';

/**
 * 1. POST /api/leads/create
 * Official Lead Creation Endpoint
 * Supports JSON payload with full Kerala Institute lead & follow-up fields.
 */
export async function POST(req: Request) {
  try {
    await connectDB();

    // Check optional Authorization header for audit / verification
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    let creatorRole = 'guest';
    let creatorName = '';
    let creatorId = '';

    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        creatorRole = decoded.role || 'admin';
        creatorName = decoded.name || '';
        creatorId = (decoded as any).id || '';
      }
    }

    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid JSON request body. Please provide lead data.',
        },
        { status: 400 }
      );
    }

    // Validation: Name is required
    if (!body.name || !String(body.name).trim()) {
      return NextResponse.json(
        {
          success: false,
          message: 'Validation failed: Student Name (name) is required.',
        },
        { status: 400 }
      );
    }

    // Validation: Contact number is required
    const contact = body.contact_number || body.phone || body.contact;
    if (!contact || !String(contact).trim()) {
      return NextResponse.json(
        {
          success: false,
          message: 'Validation failed: Contact Number (contact_number or phone) is required.',
        },
        { status: 400 }
      );
    }

    // Normalize payload
    const payload = normalizeLeadPayload(body);

    // If created by an employee (e.g. from the mobile app), the lead is automatically
    // assigned to that employee without requiring them to enter an assigned employee.
    if (creatorRole === 'employee' && creatorId) {
      const me: any = await Employee.findById(creatorId).lean();
      if (me) {
        payload.employee = me.name || payload.employee;
        payload.employee_id = me.employee_id || '';
      }
    } else {
      // If created by an admin or portal user, assigned employee is strictly required
      const assignedEmp = String(body.employee || body.assigned_to || payload.employee || '').trim();
      if (!assignedEmp || assignedEmp.toLowerCase() === 'unassigned' || assignedEmp.toLowerCase() === 'aslam') {
        return NextResponse.json(
          {
            success: false,
            message: 'Validation failed: Assigned employee is required.',
          },
          { status: 400 }
        );
      }
      payload.employee = assignedEmp;
    }

    // Make sure the assigned employee always carries both the name and the ID
    const assignment = await resolveEmployeeAssignment({
      employee: payload.employee,
      employee_id: payload.employee_id,
    });
    payload.employee = assignment.employee || payload.employee;
    payload.employee_id = assignment.employee_id;

    // Generate custom sequential student_id (STU-001, STU-002...) if not supplied
    if (!payload.student_id || !String(payload.student_id).trim()) {
      payload.student_id = await getNextStudentId();
    }

    // Ensure unique lead_id
    if (!payload.lead_id) {
      payload.lead_id = `LD-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // Save lead in MongoDB
    await assignLegacyIds([payload as any]);
    const createdLead = await Lead.create(payload);

    // Return the same shape the Flutter LeadModel parses (numeric id, int
    // status/source, snake_case timestamps) so the app can use the result
    // directly instead of only checking `success`.
    const [mobileLead] = await serializeLeadsForMobile([createdLead.toObject()]);

    return NextResponse.json(
      {
        success: true,
        message: `Lead ${createdLead.name} (${createdLead.lead_id}) created successfully`,
        endpoint: '/api/leads/create',
        authorized_by: creatorRole,
        data: mobileLead,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('POST /api/leads/create error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to create lead',
      },
      { status: 500 }
    );
  }
}

/**
 * 2. GET /api/leads/create
 * Information & Schema Guide for testing the Lead Creation endpoint.
 */
export async function GET(req: Request) {
  try {
    await connectDB();
    const latestLeads = await Lead.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    return NextResponse.json({
      success: true,
      message: 'Lead Creation Endpoint is active. Send a POST request to this endpoint to create a new lead.',
      endpoint: '/api/leads/create',
      method: 'POST',
      validation_rules: {
        required_fields: ['name', 'phone'],
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
          'employee',
          'notes',
        ],
      },
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
        employee: 'Aslam',
        notes: 'Interested in weekend batch',
      },
      sample_minimal_payload: {
        name: 'Rahul Krishna',
        phone: '9847123456',
      },
      recent_created_leads_count: latestLeads.length,
      recent_leads: latestLeads.map((l: any) => ({
        id: l._id.toString(),
        lead_id: l.lead_id,
        name: l.name,
        contact_number: l.contact_number,
        district: l.district,
        course: l.course,
        status: l.status,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

/**
 * 3. OPTIONS /api/leads/create
 * CORS Preflight Handler
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
