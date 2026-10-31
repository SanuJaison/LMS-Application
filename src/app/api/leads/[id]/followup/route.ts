import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Lead } from '@/models/lead';
import { findLeadByAnyId } from '@/lib/mobileLead';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';
import { logActivity, causerFromRequest } from '@/lib/activityLog';

/**
 * POST /api/leads/[id]/followup
 * Records a follow-up interaction on a lead.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    const lead: any = await findLeadByAnyId(id);
    if (!lead) {
      return NextResponse.json(
        { success: false, message: `Lead with ID ${id} not found.` },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));

    // If student_id is sent, verify it matches
    const providedStudentId = String(body.student_id || '').trim();
    const existingStudentId = String(lead.student_id || '').trim();

    if (
      providedStudentId &&
      existingStudentId &&
      providedStudentId.toUpperCase() !== existingStudentId.toUpperCase()
    ) {
      return NextResponse.json(
        {
          success: false,
          message: `Validation failed: Provided Student ID (${providedStudentId}) does not match registered Student ID (${existingStudentId}).`,
        },
        { status: 400 }
      );
    }

    const token = extractTokenFromHeader(req);
    const decoded = token ? verifyToken(token) : null;
    const recorderName = decoded?.name || lead.employee || 'User';

    const nextDate = body.next_followup_date || body.followup_date || '';
    const remarks = String(body.remarks || body.notes || '').trim();
    const interest = body.student_interest || lead.student_interest || 'Warm';
    const admissionStatus = body.admission_status || lead.admission_status || 'Follow-up';

    lead.next_followup_date = nextDate;
    if (remarks) lead.remarks = remarks;
    if (remarks) lead.notes = remarks;
    lead.student_interest = interest;
    lead.admission_status = admissionStatus;
    lead.status = 2; // Follow-up / Contacted

    if (!Array.isArray(lead.followups)) {
      lead.followups = [];
    }

    lead.followups.push({
      date: new Date().toISOString(),
      next_followup_date: nextDate,
      remarks,
      student_interest: interest,
      admission_status: admissionStatus,
      recorded_by: recorderName,
      lead_source: body.lead_source || lead.lead_source || '',
      payment_verification: body.payment_verification || lead.payment_verification || '',
      student_id: existingStudentId || providedStudentId,
      course: body.course || lead.interested_course || lead.course || '',
    });

    await lead.save();

    await logActivity({
      description: `Follow-up recorded for lead ${lead.name} (${lead.lead_id}). Next date: ${nextDate || 'None'}`,
      subjectType: 'Follow-up',
      causer: causerFromRequest(req),
    });

    return NextResponse.json({
      success: true,
      message: 'Follow-up recorded successfully',
      data: {
        lead_id: lead.lead_id,
        student_id: lead.student_id,
        name: lead.name,
        admission_status: lead.admission_status,
        next_followup_date: lead.next_followup_date,
        remarks: lead.remarks,
        total_followups: lead.followups.length,
      },
    });
  } catch (error: any) {
    console.error('POST /api/leads/[id]/followup error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to record follow-up' },
      { status: 500 }
    );
  }
}
