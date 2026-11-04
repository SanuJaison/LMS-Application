import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { causerFromRequest, logActivity } from '@/lib/activityLog';
import { Lead } from '@/models/lead';
import {
  andFilter,
  canAccessEmployee,
  forbidden,
  getScope,
  leadScopeFilter,
  requireAuth,
} from '@/lib/apiAuth';
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
 * Fetch leads visible to the caller.
 *   - BDE        -> only leads assigned to them
 *   - ASM / BDM  -> own leads + their BDEs' leads
 *   - SM         -> own leads + whole subtree
 *   - admin      -> all
 *
 * Query params: ?id= | ?lead_id= | ?search= | ?district= | ?status= |
 *               ?course= | ?interest= | ?employee=
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const scope = await getScope(auth);
    const { searchParams } = new URL(req.url);

    const id = searchParams.get('id');
    const leadId = searchParams.get('lead_id');

    // Single lead lookup by MongoDB ID, numeric app id, or Unique Lead ID.
    if (id || leadId) {
      const lead: any = await findLeadByAnyId(String(id || leadId));
      if (!lead) {
        return NextResponse.json({ success: false, message: 'Lead not found' }, { status: 404 });
      }

      if (!canAccessEmployee(scope, lead.employee_id, lead.employee)) {
        return forbidden('This lead is outside your hierarchy.');
      }

      if (auth.employee) {
        const [mobile] = await serializeLeadsForMobile([lead.toObject ? lead.toObject() : lead]);
        return NextResponse.json({ success: true, data: mobile });
      }

      return NextResponse.json({
        success: true,
        data: { ...lead.toObject?.(), id: lead._id.toString() },
      });
    }

    // Build filter query. Conditions are combined with $and so that adding the
    // scope below never overwrites a search/status filter.
    const conditions: Record<string, any>[] = [leadScopeFilter(scope)];

    const district = searchParams.get('district');
    if (district) conditions.push({ district });

    const status = searchParams.get('status') || searchParams.get('admission_status');
    if (status) {
      if (/^\d+$/.test(status)) {
        const num = Number(status);
        const statusValues = leadStatusValuesFromInt(num);
        // For status 1 or 2 (Pending & Follow-up leads), match both 1 and 2 and pending strings
        const numericStatuses =
          num === 1 || num === 2 ? [1, 2, '1', '2'] : [num, String(num)];
        conditions.push({
          $or: [
            { admission_status: { $in: statusValues } },
            { status: { $in: [...statusValues, ...numericStatuses] } },
          ],
        });
      } else {
        const isPendingOrFollowup =
          status === '1' ||
          status.toLowerCase() === 'pending' ||
          status.toLowerCase().includes('follow') ||
          status.toLowerCase() === 'new';
        if (isPendingOrFollowup) {
          const statusValues = leadStatusValuesFromInt(1);
          conditions.push({
            $or: [
              { admission_status: { $in: statusValues } },
              { status: { $in: [...statusValues, 1, 2, '1', '2'] } },
            ],
          });
        } else {
          const regex = new RegExp('^' + escapeRegex(status.trim()) + '$', 'i');
          conditions.push({
            $or: [
              { admission_status: regex },
              { status: regex },
            ],
          });
        }
      }
    }

    const course = searchParams.get('course') || searchParams.get('interested_course');
    if (course) conditions.push({ $or: [{ interested_course: course }, { course }] });

    const interest = searchParams.get('student_interest') || searchParams.get('interest');
    if (interest) conditions.push({ student_interest: interest });

    const employee = searchParams.get('employee');
    if (employee) {
      if (!canAccessEmployee(scope, '', employee)) {
        return forbidden('You cannot view this employee\'s leads.');
      }
      conditions.push({ employee });
    }

    const search = searchParams.get('search');
    if (search) {
      const regex = new RegExp(escapeRegex(search.trim()), 'i');
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

    const docs = await Lead.find(andFilter(...conditions)).sort({ createdAt: -1 }).lean();

    // The Flutter app parses a Laravel-style lead object with numeric ids,
    // integer status/source and snake_case timestamps.
    if (auth.employee) {
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
 * Employees always create leads assigned to themselves; managers may assign
 * within their own hierarchy.
 */
export async function POST(req: Request) {
  try {
    await connectDB();

    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const scope = await getScope(auth);
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

    let assignedEmp = String(body.employee || body.assigned_to || '').trim();
    let assignedEmpId = String(body.employee_id || '').trim();

    if (auth.employee) {
      // Employees can only create leads for themselves.
      assignedEmp = auth.name || assignedEmp;
      assignedEmpId = auth.employeeId || assignedEmpId;
    } else {
      if (
        !assignedEmp ||
        assignedEmp.toLowerCase() === 'unassigned' ||
        assignedEmp.toLowerCase() === 'aslam'
      ) {
        return NextResponse.json(
          { success: false, message: 'Validation failed: Assigned employee is required.' },
          { status: 400 }
        );
      }

      if (!auth.isAdmin && !canAccessEmployee(scope, assignedEmpId, assignedEmp)) {
        return forbidden('You cannot assign a lead to an employee outside your hierarchy.');
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
      employee: payload.employee,
      employee_id: payload.employee_id,
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
 * Update an existing lead by id, _id, or lead_id.
 * The lead must be inside the caller's hierarchy. Employees cannot reassign a
 * lead to someone else.
 */
export async function PUT(req: Request) {
  try {
    await connectDB();

    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const scope = await getScope(auth);
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

    const existing: any = await Lead.findOne(query).lean();
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Lead not found' }, { status: 404 });
    }

    if (!canAccessEmployee(scope, existing.employee_id, existing.employee)) {
      return forbidden('This lead is outside your hierarchy.');
    }

    // Synchronize aliases
    const updateData: Record<string, any> = { ...body };
    delete updateData.id;
    delete updateData._id;

    // Employees can never move a lead to another employee.
    if (auth.employee) {
      delete updateData.employee;
      delete updateData.employee_id;
    } else if (updateData.employee !== undefined || updateData.employee_id !== undefined) {
      const targetName = updateData.employee ?? existing.employee;
      const targetId = updateData.employee_id ?? existing.employee_id;
      if (!canAccessEmployee(scope, targetId, targetName)) {
        return forbidden('You cannot assign a lead to an employee outside your hierarchy.');
      }
    }

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
 * Only leads inside the caller's hierarchy can be deleted.
 */
export async function DELETE(req: Request) {
  try {
    await connectDB();

    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const scope = await getScope(auth);
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

    const objectIds = idsToDelete.filter((value) => /^[0-9a-fA-F]{24}$/.test(value));
    const idConditions: Record<string, any> = {
      $or: [
        { lead_id: { $in: idsToDelete } },
        ...(objectIds.length > 0 ? [{ _id: { $in: objectIds } }] : []),
      ],
    };

    const doomed = await Lead.find(idConditions).select('name lead_id employee employee_id').lean();

    if (!auth.isAdmin) {
      const outOfScope = (doomed as any[]).filter(
        (lead) => !canAccessEmployee(scope, lead.employee_id, lead.employee)
      );
      if (outOfScope.length > 0) {
        return forbidden('One or more leads are outside your hierarchy.');
      }
    }

    await Lead.deleteMany(idConditions);

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
      message: `${doomed.length} lead(s) deleted successfully`,
    });
  } catch (error: any) {
    console.error('DELETE /api/leads error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

function escapeRegex(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
