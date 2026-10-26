import { connectDB } from '@/lib/db';
import { getEmployee, ok } from '@/lib/employeeAuth';
import { findLeadByAnyId, serializeLeadsForMobile } from '@/lib/mobileLead';

export const dynamic = 'force-dynamic';

/**
 * POST /api/leads/:id/close
 *
 * Marks a lead as admitted / won. Accepts a MongoDB id, the numeric app id,
 * or the human readable lead_id.
 *
 * Body (the app's "close lead" form):
 *   student_id           "STU-1001"        (generated when omitted)
 *   course               "Full-Stack Web Development"
 *   payment              25000             (amount) or "verified" / "pending"
 *   payment_amount       25000             (alternative to the amount above)
 *   payment_verification "Pending" | "Verified"
 *   remarks | notes      "Admission confirmed"
 *   lead_source          "Referral"        (optional)
 *
 * Nothing is strictly required: missing values fall back to the lead's current
 * values, so an app build that closes without a body keeps working.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    const employee = await getEmployee(req);

    if (!employee) {
      return ok(null, 'Unauthenticated', 401);
    }

    const lead: any = await findLeadByAnyId(params.id);

    if (!lead) {
      return ok(null, 'Lead not found', 404);
    }

    const body = await req.json().catch(() => ({}));

    // ---- student id ------------------------------------------------------
    let studentId = String(body.student_id || body.studentId || lead.student_id || '').trim();
    if (!studentId) studentId = generateStudentId();

    // ---- course ----------------------------------------------------------
    const course = String(
      body.course || body.interested_course || lead.course || lead.interested_course || ''
    ).trim();

    // ---- payment ---------------------------------------------------------
    const paymentVerification = normalizePaymentVerification(
      body.payment_verification ||
        body.payment_status ||
        (typeof body.payment === 'string' ? body.payment : '') ||
        lead.payment_verification ||
        'Verified'
    );
    const paymentAmount = normalizePaymentAmount(body.payment_amount ?? body.payment);

    const remarks = String(body.remarks || body.notes || 'Admission confirmed').trim();
    const leadSource = String(body.lead_source || body.source || lead.lead_source || '').trim();
    const today = new Date().toISOString().split('T')[0];

    // ---- close the lead --------------------------------------------------
    lead.student_id = studentId;
    lead.course = course;
    lead.interested_course = course;
    lead.payment_verification = paymentVerification;
    if (paymentAmount !== null) lead.payment_amount = paymentAmount;
    lead.admission_status = 'Admission';
    lead.status = 'Admitted';
    lead.next_followup_date = '';
    if (leadSource) {
      lead.lead_source = leadSource;
      lead.source = leadSource;
    }
    if (remarks) {
      lead.remarks = remarks;
      lead.notes = remarks;
    }

    // Keep an audit entry so the close is visible in the follow-up history.
    if (!Array.isArray(lead.followups)) lead.followups = [];
    lead.followups.push({
      date: today,
      remarks,
      student_interest: lead.student_interest || 'Hot',
      presentation: lead.presentation || 'Completed',
      next_followup_date: '',
      admission_status: 'Admission',
      lead_source: lead.lead_source || lead.source || '',
      payment_verification: paymentVerification,
      student_id: studentId,
      course,
      proof_url: '',
      recorded_by: employee.name,
    });

    await lead.save();

    const [mobile] = await serializeLeadsForMobile([lead.toObject()]);

    return ok(mobile, 'Lead closed successfully');
  } catch (error: any) {
    console.error('POST /api/leads/[id]/close error:', error);
    return ok(null, error.message || 'Failed to close lead', 500);
  }
}

function generateStudentId(): string {
  return `STU-${Math.floor(1000 + Math.random() * 9000)}`;
}

function titleCase(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function normalizePaymentVerification(value: any): string {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return 'Verified';
  if (text === 'verified' || text === 'verifed' || text === 'paid' || text === 'done') {
    return 'Verified';
  }
  if (text === 'pending' || text === 'not verified' || text === 'unpaid') {
    return 'Pending';
  }
  return titleCase(text);
}

function normalizePaymentAmount(value: any): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
