import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Lead } from '@/models/lead';
import { Employee } from '@/models/employee';
import { Wallet } from '@/models';
import { Incentive } from '@/models/incentive';
import { findLeadByAnyId } from '@/lib/mobileLead';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';
import { logActivity, causerFromRequest } from '@/lib/activityLog';

/**
 * POST /api/leads/[id]/close
 * Closes a lead as "Admitted / Won".
 *
 * Requirements:
 * 1. Checks that the provided student_id matches the lead's student_id.
 *    If student_id does not match, the lead CANNOT close.
 * 2. Marks lead as Admitted / Closed.
 * 3. Credits ₹1,000 incentive to the BDE's wallet.
 * 4. Creates an individual Incentive record for this closed admission.
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

    // Student ID Verification:
    // "that student id is needed when follow up and closed if the student id is not same the lead should not close"
    const providedStudentId = String(body.student_id || '').trim();
    const existingStudentId = String(lead.student_id || '').trim();

    if (!providedStudentId) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Validation failed: Student ID is required to close this lead as an admission.',
        },
        { status: 400 }
      );
    }

    if (
      existingStudentId &&
      providedStudentId.toUpperCase() !== existingStudentId.toUpperCase()
    ) {
      return NextResponse.json(
        {
          success: false,
          message: `Validation failed: Provided Student ID (${providedStudentId}) does not match the registered Student ID (${existingStudentId}) for this lead. Lead cannot be closed.`,
        },
        { status: 400 }
      );
    }

    // Determine closer
    const token = extractTokenFromHeader(req);
    const decoded = token ? verifyToken(token) : null;
    let bdeEmployee: any = null;

    if (lead.employee_id) {
      bdeEmployee = await Employee.findOne({ employee_id: lead.employee_id }).lean();
    }
    if (!bdeEmployee && lead.employee && lead.employee !== 'Unassigned') {
      bdeEmployee = await Employee.findOne({
        name: new RegExp(`^${lead.employee.trim()}$`, 'i'),
      }).lean();
    }
    if (!bdeEmployee && decoded?.role === 'employee' && decoded.id) {
      bdeEmployee = await Employee.findById(decoded.id).lean();
    }

    const bdeId = bdeEmployee?.employee_id || lead.employee_id || 'BDE-UNKNOWN';
    const bdeName = bdeEmployee?.name || lead.employee || 'BDE';
    const team = bdeEmployee?.team || lead.team || '';
    const asmId = bdeEmployee?.reports_to || lead.asm_id || '';

    let asmName = lead.asm_name || '';
    if (!asmName && asmId) {
      const asmEmp: any = await Employee.findOne({ employee_id: asmId }).lean();
      if (asmEmp) asmName = asmEmp.name;
    }

    const finalStudentId = existingStudentId || providedStudentId;
    const course = body.course || lead.interested_course || lead.course || '';
    const payment = Number(body.payment ?? body.payment_amount ?? 0);
    const paymentVerification =
      body.payment_verification || lead.payment_verification || 'Verified';
    const remarks = String(body.remarks || body.notes || lead.remarks || '').trim();

    // Check if incentive already generated for this admission
    const existingIncentive = await Incentive.findOne({
      lead_id: lead.lead_id || lead._id.toString(),
    });

    const isNewlyClosed =
      lead.admission_status !== 'Admitted' &&
      lead.admission_status !== 'Closed' &&
      lead.status !== 4 &&
      lead.status !== 5;

    // Update lead document
    lead.admission_status = 'Admitted';
    lead.status = 4; // Admitted / Won
    lead.student_id = finalStudentId;
    if (course) lead.course = course;
    if (course) lead.interested_course = course;
    lead.payment_amount = payment;
    lead.payment_verification = paymentVerification;
    lead.admission_date = lead.admission_date || new Date();
    lead.incentive_amount = 1000;
    lead.incentive_status = 'Credited';
    lead.bde_id = bdeId;
    lead.bde_name = bdeName;
    lead.asm_id = asmId;
    lead.asm_name = asmName;
    lead.team = team;
    if (remarks) lead.remarks = remarks;

    // Append to followups history
    if (!Array.isArray(lead.followups)) {
      lead.followups = [];
    }
    lead.followups.push({
      date: new Date().toISOString(),
      student_id: finalStudentId,
      admission_status: 'Admitted',
      payment_verification: paymentVerification,
      payment_amount: payment,
      course,
      remarks: remarks || 'Lead confirmed as admission. Closed successfully.',
      recorded_by: bdeName,
    });

    await lead.save();

    // Incentive processing: ₹1,000 per closed admission
    let incentiveRecord = existingIncentive;
    if (!existingIncentive && isNewlyClosed) {
      incentiveRecord = await Incentive.create({
        lead_id: lead.lead_id || lead._id.toString(),
        student_id: finalStudentId,
        student_name: lead.name,
        course,
        bde_id: bdeId,
        bde_name: bdeName,
        asm_id: asmId,
        asm_name: asmName,
        team,
        amount: 1000,
        status: 'Earned',
        admission_date: new Date(),
      });

      // Credit ₹1,000 to BDE wallet
      await Wallet.findOneAndUpdate(
        {
          $or: [
            { employee_id: bdeId },
            { employee: new RegExp(`^${bdeName.trim()}$`, 'i') },
          ],
        },
        {
          $setOnInsert: {
            employee: bdeName,
            employee_id: bdeId,
            currency: 'INR',
          },
          $inc: {
            balance: 1000,
            total_earned: 1000,
          },
        },
        { upsert: true, new: true }
      );
    }

    await logActivity({
      description: `Admission closed for student ${lead.name} (${finalStudentId}) by ${bdeName}. ₹1,000 incentive credited.`,
      subjectType: 'Admission',
      causer: causerFromRequest(req),
    });

    return NextResponse.json({
      success: true,
      message: `Lead ${lead.name} successfully closed as Admission (${finalStudentId}). ₹1,000 incentive credited to ${bdeName}.`,
      data: {
        lead_id: lead.lead_id,
        student_id: finalStudentId,
        name: lead.name,
        status: 4,
        admission_status: 'Admitted',
        incentive_earned: 1000,
        incentive_id: incentiveRecord?._id?.toString() || null,
        bde: bdeName,
        team,
      },
    });
  } catch (error: any) {
    console.error('POST /api/leads/[id]/close error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to close lead' },
      { status: 500 }
    );
  }
}
