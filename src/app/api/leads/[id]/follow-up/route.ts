import { connectDB } from '@/lib/db';
import { getEmployee, ok } from '@/lib/employeeAuth';
import { findLeadByAnyId, serializeLeadsForMobile } from '@/lib/mobileLead';

export const dynamic = 'force-dynamic';

/**
 * POST /api/leads/:id/follow-up   (alias: /api/leads/:id/followup)
 *
 * Records one follow-up on a lead and mirrors the latest values onto the lead.
 *
 * Body (all optional, but the app normally sends the first group):
 *   lead_source          "College Visit" | "Seminar" | "Referral" | "Social Media" | ...
 *   student_interest     "Cold" | "Warm" | "Hot"
 *   next_followup_date   "2026-10-30"
 *   remarks | notes      "Called again, asked for fee details"
 *   admission_status     "New Lead" | "Follow Uped" | "Payment Pending" |
 *                        "Admission" | "Not Interested"
 *   payment_verification "Pending" | "Verified"
 *   student_id           "STU-1001"   (required once admission is confirmed)
 *   course               "Full-Stack Web Development"
 *   followup_date        "2026-10-27"  (defaults to today)
 *   proof_url            ""
 *
 * Accepts a MongoDB id, the numeric app id, or the human readable lead_id.
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
    const today = new Date().toISOString().split('T')[0];

    // ---- lead source -----------------------------------------------------
    const leadSource = String(
      body.lead_source || body.source || lead.lead_source || lead.source || ''
    ).trim();

    // ---- student interest (Cold / Warm / Hot) ----------------------------
    const rawInterest = body.student_interest || body.interest;
    const studentInterest = rawInterest
      ? titleCase(String(rawInterest).trim())
      : lead.student_interest || 'Medium';

    // ---- admission status ------------------------------------------------
    const admissionStatus = String(
      body.admission_status || body.status || body.type || lead.admission_status || 'Follow Up'
    ).trim();

    // ---- payment verification -------------------------------------------
    const paymentVerification = normalizePaymentVerification(
      body.payment_verification ||
        body.payment_status ||
        (typeof body.payment === 'string' ? body.payment : '') ||
        lead.payment_verification ||
        'Pending'
    );

    const paymentAmount = normalizePaymentAmount(body.payment_amount ?? body.payment);

    // ---- student / course ------------------------------------------------
    const course = String(
      body.course || body.interested_course || lead.course || lead.interested_course || ''
    ).trim();

    let studentId = String(body.student_id || body.studentId || lead.student_id || '').trim();
    if (!studentId && isAdmittedStatus(admissionStatus)) {
      studentId = generateStudentId();
    }

    const remarks = String(body.notes || body.remarks || '');
    const nextFollowupDate = String(
      body.next_followup_date || body.next_follow_up_date || body.next_followup || ''
    ).trim();
    const followupDate = String(body.followup_date || body.date || today).trim();

    // ---- append the follow-up log ---------------------------------------
    const entry = {
      date: followupDate,
      remarks,
      student_interest: studentInterest,
      presentation: String(body.presentation || lead.presentation || 'Not Scheduled'),
      next_followup_date: nextFollowupDate,
      admission_status: admissionStatus,
      lead_source: leadSource,
      payment_verification: paymentVerification,
      student_id: studentId,
      course,
      proof_url: String(body.proof_url || ''),
      recorded_by: employee.name,
    };

    if (!Array.isArray(lead.followups)) lead.followups = [];
    lead.followups.push(entry);

    // ---- mirror the latest follow-up onto the lead -----------------------
    lead.lead_source = leadSource;
    lead.source = leadSource;
    lead.student_interest = studentInterest;
    lead.presentation = entry.presentation;
    lead.next_followup_date = nextFollowupDate;
    lead.admission_status = admissionStatus;
    lead.status = admissionStatus;
    lead.payment_verification = paymentVerification;
    if (paymentAmount !== null) lead.payment_amount = paymentAmount;
    lead.student_id = studentId;
    lead.course = course;
    lead.interested_course = course;

    if (remarks) {
      lead.remarks = remarks;
      lead.notes = remarks;
    }

    await lead.save();

    const [mobile] = await serializeLeadsForMobile([lead.toObject()]);

    return ok(mobile, 'Follow-up recorded successfully');
  } catch (error: any) {
    console.error('POST /api/leads/[id]/follow-up error:', error);
    return ok(null, error.message || 'Failed to record follow-up', 500);
  }
}

function titleCase(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function isAdmittedStatus(value: string): boolean {
  const status = value.toLowerCase();
  return status === 'admission' || status === 'admitted' || status === 'won' || status === 'enrolled';
}

function generateStudentId(): string {
  return `STU-${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * "verifed" (typo used by the app) -> "Verified", "pending" -> "Pending".
 */
function normalizePaymentVerification(value: any): string {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return 'Pending';
  if (text === 'verified' || text === 'verifed' || text === 'paid' || text === 'done') {
    return 'Verified';
  }
  if (text === 'pending' || text === 'not verified' || text === 'unpaid') {
    return 'Pending';
  }
  return titleCase(text);
}

/**
 * Accepts a number, or a numeric string. Returns null when the value is not a
 * usable amount (e.g. "verified"), so the stored amount is left untouched.
 */
function normalizePaymentAmount(value: any): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
