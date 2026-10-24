import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Lead } from '@/models/lead';

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

    // Single lead lookup by MongoDB ID or Unique Lead ID (e.g., LD-1001)
    if (id || leadId) {
      const query = id ? { _id: id } : { lead_id: leadId };
      const lead = await Lead.findOne(query).lean();
      if (!lead) {
        return NextResponse.json({ success: false, message: 'Lead not found' }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        data: { ...lead, id: (lead as any)._id.toString() },
      });
    }

    // Build filter query
    const filter: Record<string, any> = {};

    const district = searchParams.get('district');
    if (district) filter.district = district;

    const status = searchParams.get('status') || searchParams.get('admission_status');
    if (status) {
      filter.$or = [{ admission_status: status }, { status: status }];
    }

    const course = searchParams.get('course') || searchParams.get('interested_course');
    if (course) {
      filter.$or = [{ interested_course: course }, { course: course }];
    }

    const interest = searchParams.get('student_interest') || searchParams.get('interest');
    if (interest) filter.student_interest = interest;

    const employee = searchParams.get('employee');
    if (employee) filter.employee = employee;

    const search = searchParams.get('search');
    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
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
      ];
    }

    const docs = await Lead.find(filter).sort({ createdAt: -1 }).lean();
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

    // Auto-generate unique Lead ID if not provided
    const leadId = body.lead_id || `LD-${Math.floor(1000 + Math.random() * 9000)}`;

    // Auto-generate Student ID if status is Admitted
    const admissionStatus = body.admission_status || body.status || 'New';
    const isAdmitted =
      admissionStatus === 'Admitted' || admissionStatus === 'Won' || body.status === 4;
    let studentId = body.student_id || '';
    if (isAdmitted && !studentId) {
      studentId = `STU-${Math.floor(1000 + Math.random() * 9000)}`;
    }

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
      employee: (body.employee || 'Aslam').trim(),
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

    const created = await Lead.create(payload);

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
    await Lead.deleteMany({
      $or: [{ _id: { $in: idsToDelete } }, { lead_id: { $in: idsToDelete } }],
    });

    return NextResponse.json({
      success: true,
      message: `${idsToDelete.length} lead(s) deleted successfully`,
    });
  } catch (error: any) {
    console.error('DELETE /api/leads error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
