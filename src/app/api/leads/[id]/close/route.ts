import { connectDB } from '@/lib/db';
import { getEmployee, ok } from '@/lib/employeeAuth';
import { findLeadByAnyId, serializeLeadsForMobile } from '@/lib/mobileLead';

export const dynamic = 'force-dynamic';

/**
 * POST /api/leads/:id/close
 * Marks a lead as admitted / won. Accepts a MongoDB id, the numeric app id,
 * or the human readable lead_id.
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

    lead.admission_status = 'Admitted';
    lead.status = 'Admitted';
    if (!lead.student_id) {
      lead.student_id = `STU-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    await lead.save();

    const [mobile] = await serializeLeadsForMobile([lead.toObject()]);

    return ok(mobile, 'Lead closed successfully');
  } catch (error: any) {
    console.error('POST /api/leads/[id]/close error:', error);
    return ok(null, error.message || 'Failed to close lead', 500);
  }
}
