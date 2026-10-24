import { connectDB } from '@/lib/db';
import { getEmployee, ok } from '@/lib/employeeAuth';
import { findLeadByAnyId, serializeLeadsForMobile } from '@/lib/mobileLead';

export const dynamic = 'force-dynamic';

/**
 * POST /api/leads/:id/follow-up
 * Body: { remarks, notes, type, followup_date, next_followup_date,
 *         student_interest, presentation, admission_status, proof_url }
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

    const entry = {
      date: String(body.followup_date || body.date || today),
      remarks: String(body.notes || body.remarks || ''),
      student_interest: String(body.student_interest || lead.student_interest || 'Medium'),
      presentation: String(body.presentation || lead.presentation || 'Not Scheduled'),
      next_followup_date: String(body.next_followup_date || lead.next_followup_date || ''),
      admission_status: String(
        body.admission_status || body.type || lead.admission_status || 'Follow Up'
      ),
      proof_url: String(body.proof_url || ''),
      recorded_by: employee.name,
    };

    if (!Array.isArray(lead.followups)) lead.followups = [];
    lead.followups.push(entry);

    // Mirror the latest follow-up onto the lead itself
    lead.student_interest = entry.student_interest;
    lead.presentation = entry.presentation;
    lead.next_followup_date = entry.next_followup_date;
    lead.admission_status = entry.admission_status;
    lead.status = entry.admission_status;
    if (entry.remarks) {
      lead.remarks = entry.remarks;
      lead.notes = entry.remarks;
    }

    await lead.save();

    const [mobile] = await serializeLeadsForMobile([lead.toObject()]);

    return ok(mobile, 'Follow-up recorded successfully');
  } catch (error: any) {
    console.error('POST /api/leads/[id]/follow-up error:', error);
    return ok(null, error.message || 'Failed to record follow-up', 500);
  }
}
