import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Lead } from '@/models/lead';

/**
 * 1. GET /api/followups
 * Fetch follow-up pipeline records, scheduled presentations, and follow-up histories.
 * Query params: ?lead_id= | ?status= | ?presentation= | ?student_interest= | ?due=today|upcoming|overdue
 */
export async function GET(req: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);

    const leadId = searchParams.get('lead_id') || searchParams.get('id');

    // Single lead follow-up history
    if (leadId) {
      const query = leadId.startsWith('LD-') ? { lead_id: leadId } : { _id: leadId };
      const lead: any = await Lead.findOne(query).lean();

      if (!lead) {
        return NextResponse.json({ success: false, message: 'Lead not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: {
          lead_id: lead.lead_id,
          name: lead.name,
          contact_number: lead.contact_number || lead.phone,
          whats_number: lead.whats_number || lead.whatsapp_number,
          district: lead.district,
          place: lead.place,
          course: lead.interested_course || lead.course,
          employee: lead.employee,
          student_interest: lead.student_interest || 'Medium',
          presentation: lead.presentation || 'Not Scheduled',
          next_followup_date: lead.next_followup_date || '',
          admission_status: lead.admission_status || lead.status || 'New',
          student_id: lead.student_id || '',
          proof_url: lead.proof_url || '',
          followups_count: (lead.followups || []).length,
          followups: lead.followups || [],
        },
      });
    }

    // Build filter for Follow-up Pipeline
    const filter: Record<string, any> = {};

    const status = searchParams.get('status') || searchParams.get('admission_status');
    if (status) {
      filter.$or = [{ admission_status: status }, { status: status }];
    }

    const presentation = searchParams.get('presentation');
    if (presentation) filter.presentation = presentation;

    const interest = searchParams.get('student_interest') || searchParams.get('interest');
    if (interest) filter.student_interest = interest;

    const todayStr = new Date().toISOString().split('T')[0];
    const due = searchParams.get('due');
    if (due === 'today') {
      filter.next_followup_date = todayStr;
    } else if (due === 'upcoming') {
      filter.next_followup_date = { $gte: todayStr };
    } else if (due === 'overdue') {
      filter.next_followup_date = { $lt: todayStr, $ne: '' };
      filter.admission_status = { $nin: ['Admitted', 'Won'] };
    }

    const leads: any[] = await Lead.find(filter).sort({ updatedAt: -1 }).lean();

    const data = leads.map((l) => ({
      id: l._id.toString(),
      _id: l._id.toString(),
      lead_id: l.lead_id,
      name: l.name,
      contact_number: l.contact_number || l.phone,
      whats_number: l.whats_number || l.whatsapp_number,
      district: l.district,
      place: l.place,
      qualification: l.qualification,
      college_name: l.college_name,
      current_year: l.current_year,
      interested_topic: l.interested_topic,
      course: l.interested_course || l.course,
      employee: l.employee,
      student_interest: l.student_interest || 'Medium',
      presentation: l.presentation || 'Not Scheduled',
      next_followup_date: l.next_followup_date || '',
      admission_status: l.admission_status || l.status || 'New',
      student_id: l.student_id || '',
      proof_url: l.proof_url || '',
      remarks: l.remarks || l.notes || '',
      total_followups: (l.followups || []).length,
      latest_followup: (l.followups || [])[0] || null,
      followups: l.followups || [],
    }));

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error: any) {
    console.error('GET /api/followups error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

/**
 * 2. POST /api/followups
 * Log a new follow-up interaction for a lead.
 * Updates the lead's current state and appends to the follow-up history log.
 */
export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();

    const leadIdentifier = body.lead_id || body.id || body._id;
    if (!leadIdentifier) {
      return NextResponse.json(
        { success: false, message: 'lead_id or id is required to log follow-up' },
        { status: 400 }
      );
    }

    if (!body.remarks || !body.remarks.trim()) {
      return NextResponse.json(
        { success: false, message: 'Remarks / discussion summary is required' },
        { status: 400 }
      );
    }

    const query = String(leadIdentifier).startsWith('LD-')
      ? { lead_id: leadIdentifier }
      : { _id: leadIdentifier };

    const lead: any = await Lead.findOne(query);
    if (!lead) {
      return NextResponse.json({ success: false, message: 'Lead not found' }, { status: 404 });
    }

    if (!lead.lead_id) {
      lead.lead_id = `LD-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const todayDate = body.date || new Date().toISOString().split('T')[0];
    const admissionStatus = body.admission_status || lead.admission_status || 'Follow Up';
    const isAdmitted = admissionStatus === 'Admitted' || admissionStatus === 'Won';

    // Auto-generate or set Student ID upon admission
    let studentId = body.student_id || lead.student_id || '';
    if (isAdmitted && !studentId) {
      studentId = `STU-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // New Follow-up entry
    const newFollowupEntry = {
      date: todayDate,
      remarks: body.remarks.trim(),
      student_interest: body.student_interest || lead.student_interest || 'Medium',
      presentation: body.presentation || lead.presentation || 'Not Scheduled',
      next_followup_date: body.next_followup_date || '',
      admission_status: admissionStatus,
      proof_url: (body.proof_url || '').trim(),
      recorded_by: body.recorded_by || lead.employee || 'Counselor',
    };

    // Update parent lead record
    lead.student_interest = newFollowupEntry.student_interest;
    lead.presentation = newFollowupEntry.presentation;
    lead.next_followup_date = newFollowupEntry.next_followup_date;
    lead.admission_status = admissionStatus;
    lead.status = admissionStatus;
    lead.student_id = studentId;
    lead.remarks = newFollowupEntry.remarks;
    lead.notes = newFollowupEntry.remarks;
    if (body.proof_url) lead.proof_url = body.proof_url.trim();
    if (body.course) {
      lead.course = body.course.trim();
      lead.interested_course = body.course.trim();
    }

    // Prepend to followups history array
    lead.followups = [newFollowupEntry, ...(lead.followups || [])];

    await lead.save();

    return NextResponse.json({
      success: true,
      message: isAdmitted
        ? `Admission confirmed for ${lead.name}! Student ID: ${studentId}`
        : `Follow-up logged successfully for ${lead.name} (${lead.lead_id})`,
      data: {
        ...lead.toObject(),
        id: lead._id.toString(),
      },
    });
  } catch (error: any) {
    console.error('POST /api/followups error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
