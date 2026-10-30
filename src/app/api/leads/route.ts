import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';
import { causerFromRequest, logActivity } from '@/lib/activityLog';
import { Lead } from '@/models/lead';
import { Employee } from '@/models/employee';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';
import { escapeRegex } from '@/lib/employeeAuth';
import { getNextStudentId } from '@/lib/studentId';
import {
  assignLegacyIds,
  findLeadByAnyId,
  leadStatusValuesFromInt,
  resolveEmployeeAssignment,
  serializeLeadsForMobile,
} from '@/lib/mobileLead';

/**
 * 1. GET /api/leads
 * Fetch all leads or filter by search query, district, status, course, or employee.
 * Query params: ?id= | ?lead_id= | ?search= | ?district= | ?status= | ?course= | ?interest= | ?employee=
 */
export async function GET(req: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);

    const id = searchParams.get('id');
    const leadId = searchParams.get('lead_id');

    // Single lead lookup by MongoDB ID, numeric app id, or Unique Lead ID (e.g., LD-1001)
    if (id || leadId) {
      const lead: any = await findLeadByAnyId(String(id || leadId));
      if (!lead) {
        return NextResponse.json({ success: false, message: 'Lead not found' }, { status: 404 });
      }
      const tokenForSingle = extractTokenFromHeader(req);
      const decodedForSingle = tokenForSingle ? verifyToken(tokenForSingle) : null;

      if (decodedForSingle?.role === 'employee') {
        const [mobile] = await serializeLeadsForMobile([lead.toObject ? lead.toObject() : lead]);
        return NextResponse.json({ success: true, data: mobile });
      }

      return NextResponse.json({
        success: true,
        data: { ...lead.toObject?.(), id: lead._id.toString() },
      });
    }

    // Build filter query. Conditions are combined with $and so that adding the
    // employee scope below never overwrites a search/status filter.
    const conditions: Record<string, any>[] = [];

    const district = searchParams.get('district');
    if (district) conditions.push({ district });

    const status = searchParams.get('status') || searchParams.get('admission_status');
    if (status) {
      // The mobile app sends a numeric status (1 New, 4 Admitted, 5 Closed)
      const statusValues = /^\d+$/.test(status)
        ? leadStatusValuesFromInt(Number(status))
        : [status];
      conditions.push({
        $or: [
          { admission_status: { $in: statusValues } },
          { status: { $in: statusValues } },
        ],
      });
    }

    const course = searchParams.get('course') || searchParams.get('interested_course');
    if (course) conditions.push({ $or: [{ interested_course: course }, { course }] });

    const interest = searchParams.get('student_interest') || searchParams.get('interest');
    if (interest) conditions.push({ student_interest: interest });

    const employee = searchParams.get('employee');
    if (employee) conditions.push({ employee });

    const search = searchParams.get('search');
    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      conditions.push({
        $or: [
          { name: regex },
          { lead_id: regex },
          { contact_number: regex },
          { phone: regex },
          { whats_number: regex },
          { district: regex },
          { place: regex },
          { college_name: regex },
          { qualification: regex },
          { interested_topic: regex },
          { course: regex },
          { student_id: regex },
        ],
      });
    }

    // Employees only see the leads assigned to them. Admin/manager requests are
    // unchanged and still receive every lead.
    const token = extractTokenFromHeader(req);
    const decoded = token ? verifyToken(token) : null;
    if (decoded?.role === 'employee') {
      const me: any = await Employee.findById(decoded.id).lean();

      if (!me) {
        conditions.push({ employee: '__none__' });
      } else {
        const mine: Record<string, any>[] = [];
        if (me.name) mine.push({ employee: new RegExp(`^${escapeRegex(me.name)}$`, 'i') });
        if (me.employee_id) mine.push({ employee_id: me.employee_id });
        conditions.push(mine.length ? { $or: mine } : { employee: '__none__' });
      }
    }

    const filter: Record<string, any> = conditions.length ? { $and: conditions } : {};

    const docs = await Lead.find(filter).sort({ createdAt: -1 }).lean();

    // The Flutter app parses a Laravel-style lead object with numeric ids,
    // integer status/source and snake_case timestamps.
    if (decoded?.role === 'employee') {
      const mobile = await serializeLeadsForMobile(docs as any[]);
      return NextResponse.json({
        success: true,
        count: mobile.length,
        data: mobile,
      });
    }

    const data = docs.map((doc: any) => ({ ...doc, id: doc._id.toString() }));

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error: any) {
    console.error('GET /api/leads error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

/**
 * 2. POST /api/leads
 * Lead Generation: Create a new lead with all Kerala Institute fields.
 */
export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { success: false, message: 'Student Name is required' },
        { status: 400 }
      );
    }

    const contact = body.contact_number || body.phone || body.contact;
    if (!contact || !String(contact).trim()) {
      return NextResponse.json(
        { success: false, message: 'Contact Number is required' },
        { status: 400 }
      );
    }

    // Check optional Authorization header
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    let creatorRole = 'guest';
    let creatorId = '';
    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        creatorRole = decoded.role || 'admin';
        creatorId = decoded.id || '';
      }
    }

    let assignedEmp = String(body.employee || body.assigned_to || '').trim();
    let assignedEmpId = String(body.employee_id || '').trim();

    if (creatorRole === 'employee' && creatorId) {
      const me = await Employee.findById(creatorId).lean();
      if (me) {
        assignedEmp = me.name || assignedEmp;
        assignedEmpId = me.employee_id || assignedEmpId;
      }
    } else {
      if (!assignedEmp || assignedEmp.toLowerCase() === 'unassigned' || assignedEmp.toLowerCase() === 'aslam') {
        return NextResponse.json(
          { success: false, message: 'Validation failed: Assigned employee is required.' },
          { status: 400 }
        );
      }
    }

    // Auto-generate unique Lead ID if not provided
    const leadId = body.lead_id || `LD-${Math.floor(1000 + Math.random() * 9000)}`;

    // Auto-generate sequential student_id if not provided
    let studentId = body.student_id ? String(body.student_id).trim() : '';
    if (!studentId) {
      studentId = await getNextStudentId();
    }
    const admissionStatus = body.admission_status || body.status || 'New';

    const payload = {
      lead_id: leadId,
      name: body.name.trim(),
      contact_number: String(contact).trim(),
      phone: String(contact).trim(),
      whats_number: String(body.whats_number || body.whatsapp_number || contact).trim(),
      whatsapp_number: String(body.whats_number || body.whatsapp_number || contact).trim(),
      district: body.district || 'Ernakulam',
      place: (body.place || '').trim(),
      age: body.age ? Number(body.age) : undefined,
      qualification: (body.qualification || '').trim(),
      college_name: (body.college_name || '').trim(),
      current_year: (body.current_year || '').trim(),
      interested_topic: (body.interested_topic || '').trim(),
      interested_course: (body.interested_course || body.course || '').trim(),
      course: (body.course || body.interested_course || '').trim(),
      employee: assignedEmp,
      employee_id: assignedEmpId,
      email: (body.email || '').trim(),
      address: (body.address || '').trim(),

      // Follow-up & Admission
      lead_source: body.lead_source || body.source || 'Campus Drive / College Seminar',
      source: body.source || body.lead_source || 'Campus Drive / College Seminar',
      student_interest: body.student_interest || 'Medium',
      next_followup_date: body.next_followup_date || '',
      remarks: (body.remarks || body.notes || '').trim(),
      notes: (body.notes || body.remarks || '').trim(),
      admission_status: admissionStatus,
      status: admissionStatus,
      presentation: body.presentation || 'Not Scheduled',
      student_id: studentId,
      proof_url: (body.proof_url || '').trim(),
      followups: Array.isArray(body.followups) ? body.followups : [],
    };

    // Resolve the assigned employee so both the name and the employee ID are
    // stored. Accepts a name ("Aslam") or an ID ("BDE001").
    const assignment = await resolveEmployeeAssignment({
      employee: body.employee || payload.employee,
      employee_id: body.employee_id || payload.employee_id,
    });
    payload.employee = assignment.employee || payload.employee;
    payload.employee_id = assignment.employee_id;

    await assignLegacyIds([payload as any]);

    const created = await Lead.create(payload);

    await logActivity({
      description: `Created lead "${created.name}" (${created.lead_id})`,
      subjectType: 'Lead',
      causer: causerFromRequest(req),
    });

    return NextResponse.json(
      {
        success: true,
        message: `Lead ${created.name} (${created.lead_id}) created successfully`,
        data: { ...created.toObject(), id: created._id.toString() },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('POST /api/leads error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

/**
 * 3. PUT /api/leads
 * Update existing lead by id, _id, or lead_id.
 */
export async function PUT(req: Request) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;

    await connectDB();
    const body = await req.json();

    const id = body.id || body._id;
    const leadId = body.lead_id;

    if (!id && !leadId) {
      return NextResponse.json(
        { success: false, message: 'Lead ID or _id is required for update' },
        { status: 400 }
      );
    }

    const query = id ? { _id: id } : { lead_id: leadId };

    // Synchronize aliases
    const updateData: Record<string, any> = { ...body };
    delete updateData.id;

    if (updateData.age !== undefined) {
      if (updateData.age === '' || updateData.age === null) delete updateData.age;
      else updateData.age = Number(updateData.age);
    }

    if (updateData.contact_number && !updateData.phone) updateData.phone = updateData.contact_number;
    if (updateData.phone && !updateData.contact_number) updateData.contact_number = updateData.phone;
    if (updateData.whats_number && !updateData.whatsapp_number) updateData.whatsapp_number = updateData.whats_number;
    if (updateData.whatsapp_number && !updateData.whats_number) updateData.whats_number = updateData.whatsapp_number;
    if (updateData.interested_course && !updateData.course) updateData.course = updateData.interested_course;
    if (updateData.course && !updateData.interested_course) updateData.interested_course = updateData.course;
    if (updateData.lead_source && !updateData.source) updateData.source = updateData.lead_source;
    if (updateData.source && !updateData.lead_source) updateData.lead_source = updateData.source;
    if (updateData.admission_status && !updateData.status) updateData.status = updateData.admission_status;
    if (updateData.status && !updateData.admission_status) updateData.admission_status = updateData.status;
    if (updateData.remarks && !updateData.notes) updateData.notes = updateData.remarks;
    if (updateData.notes && !updateData.remarks) updateData.remarks = updateData.notes;

    // Keep employee name + employee ID in sync when either one is changed
    if (updateData.employee !== undefined || updateData.employee_id !== undefined) {
      const assignment = await resolveEmployeeAssignment({
        employee: updateData.employee,
        employee_id: updateData.employee_id,
      });
      updateData.employee = assignment.employee;
      updateData.employee_id = assignment.employee_id;
    }

    // Auto-generate student_id if marked as Admitted without one
    const isAdmitted =
      updateData.admission_status === 'Admitted' ||
      updateData.admission_status === 'Won' ||
      updateData.status === 'Won' ||
      updateData.status === 4;
    if (isAdmitted && !updateData.student_id) {
      updateData.student_id = `STU-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const updated = await Lead.findOneAndUpdate(query, updateData, { new: true });

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Lead not found' }, { status: 404 });
    }

    await logActivity({
      description: `Updated lead "${updated.name}" (${updated.lead_id})`,
      subjectType: 'Lead',
      causer: causerFromRequest(req),
    });

    return NextResponse.json({
      success: true,
      message: 'Lead updated successfully',
      data: { ...updated.toObject(), id: updated._id.toString() },
    });
  } catch (error: any) {
    console.error('PUT /api/leads error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

/**
 * 4. DELETE /api/leads
 * Delete lead(s) by query parameter ?id= or JSON body { id: "..." } or { ids: [...] }.
 */
export async function DELETE(req: Request) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;

    await connectDB();
    const { searchParams } = new URL(req.url);
    const idFromQuery = searchParams.get('id') || searchParams.get('lead_id');

    let idsToDelete: string[] = [];
    if (idFromQuery) {
      idsToDelete = [idFromQuery];
    } else {
      const body = await req.json().catch(() => ({}));
      if (body.ids && Array.isArray(body.ids)) {
        idsToDelete = body.ids;
      } else if (body.id || body._id || body.lead_id) {
        idsToDelete = [body.id || body._id || body.lead_id];
      }
    }

    if (!idsToDelete.length) {
      return NextResponse.json(
        { success: false, message: 'Lead ID(s) required to delete' },
        { status: 400 }
      );
    }

    // Delete by _id or lead_id
    const doomed = await Lead.find({
      $or: [{ _id: { $in: idsToDelete } }, { lead_id: { $in: idsToDelete } }],
    })
      .select('name lead_id')
      .lean();

    await Lead.deleteMany({
      $or: [{ _id: { $in: idsToDelete } }, { lead_id: { $in: idsToDelete } }],
    });

    if (doomed.length > 0) {
      const single = doomed.length === 1 ? (doomed[0] as any) : null;
      await logActivity({
        description: single
          ? `Deleted lead "${single.name}" (${single.lead_id})`
          : `Deleted ${doomed.length} leads`,
        subjectType: 'Lead',
        causer: causerFromRequest(req),
      });
    }

    return NextResponse.json({
      success: true,
      message: `${idsToDelete.length} lead(s) deleted successfully`,
    });
  } catch (error: any) {
    console.error('DELETE /api/leads error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
