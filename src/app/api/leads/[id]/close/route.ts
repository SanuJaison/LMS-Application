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
 * POST /api/leads/:id/close
 * Marks a lead as admitted / won.
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

    lead.admission_status = 'Admitted';
    lead.status = 'Admitted';
    if (!lead.student_id) {
      lead.student_id = `STU-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    await lead.save();

    return ok(lead, 'Lead closed successfully');
  } catch (error: any) {
    console.error('POST /api/leads/[id]/close error:', error);
    return ok(null, error.message || 'Failed to close lead', 500);
  }
}
