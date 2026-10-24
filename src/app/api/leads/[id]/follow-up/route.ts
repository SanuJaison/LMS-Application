import { connectDB } from '@/lib/db';
import { Lead } from '@/models/lead';
import { getEmployee, ok } from '@/lib/employeeAuth';

export const dynamic = 'force-dynamic';

function leadLookup(id: string) {
  const value = String(id || '').trim();
  if (/^[0-9a-fA-F]{24}$/.test(value)) return { _id: value };
  return { lead_id: value };
}

/**
 * POST /api/leads/:id/follow-up
 * Body: { remarks, student_interest, presentation, next_followup_date, admission_status, proof_url }
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    const employee = await getEmployee(req);

    if (!employee) {
      return ok(null, 'Unauthenticated', 401);
    }

    const lead: any = await Lead.findOne(leadLookup(params.id));

    if (!lead) {
      return ok(null, 'Lead not found', 404);
    }

    const body = await req.json().catch(() => ({}));
    const today = new Date().toISOString().split('T')[0];

    const entry = {
      date: String(body.date || today),
      remarks: String(body.remarks || body.notes || ''),
      student_interest: String(body.student_interest || lead.student_interest || 'Medium'),
      presentation: String(body.presentation || lead.presentation || 'Not Scheduled'),
      next_followup_date: String(body.next_followup_date || lead.next_followup_date || ''),
      admission_status: String(body.admission_status || lead.admission_status || 'Follow Up'),
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

    return ok(lead, 'Follow-up recorded successfully');
  } catch (error: any) {
    console.error('POST /api/leads/[id]/follow-up error:', error);
    return ok(null, error.message || 'Failed to record follow-up', 500);
  }
}
