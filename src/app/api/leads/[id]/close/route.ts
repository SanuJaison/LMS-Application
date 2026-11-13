import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Lead } from '@/models/lead';
import { Employee } from '@/models/employee';
import { Wallet } from '@/models';
import { Incentive } from '@/models/incentive';
import { findLeadByAnyId } from '@/lib/mobileLead';
import { getNextStudentId } from '@/lib/studentId';
import { syncAllEmployeeTaskAchievements } from '@/lib/targetSync';
import { logActivity, causerFromRequest } from '@/lib/activityLog';
import { canAccessEmployee, forbidden, getScope, requireAuth } from '@/lib/apiAuth';

/**
 * POST /api/leads/[id]/close
 * Closes a lead as "Admitted / Won".
 *
 * Multi-Tier Incentive Structure:
 * 1. BDE: Receives ₹1,000 direct commission into their wallet.
 * 2. ASM: Receives ₹100 team override into their wallet.
 * 3. SM:  Receives ₹20 state override into their wallet.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const scope = await getScope(auth);

    const lead: any = await findLeadByAnyId(id);
    if (!lead) {
      return NextResponse.json(
        { success: false, message: `Lead with ID ${id} not found.` },
        { status: 404 }
      );
    }

    if (!canAccessEmployee(scope, lead.employee_id, lead.employee)) {
      return forbidden('This lead is outside your hierarchy.');
    }

    const body = await req.json().catch(() => ({}));

    // Student ID Verification:
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
          message: `Validation failed: Provided Student ID (${providedStudentId}) does not match the registered Student ID (${existingStudentId}) for this lead. Lead cannot be closed.`,
        },
        { status: 400 }
      );
    }

    // Determine closer (BDE)
    let bdeEmployee: any = null;

    if (lead.employee_id) {
      bdeEmployee = await Employee.findOne({ employee_id: lead.employee_id }).lean();
    }
    if (!bdeEmployee && lead.employee && lead.employee !== 'Unassigned') {
      bdeEmployee = await Employee.findOne({
        name: new RegExp(`^${escapeRegex(lead.employee.trim())}$`, 'i'),
      }).lean();
    }
    if (!bdeEmployee && auth.employee) {
      bdeEmployee = auth.employee;
    }

    const bdeId = bdeEmployee?.employee_id || lead.employee_id || 'BDE-UNKNOWN';
    const bdeName = bdeEmployee?.name || lead.employee || 'BDE';
    const team = bdeEmployee?.team || lead.team || '';

    // Determine reporting ASM
    let asmId = bdeEmployee?.reports_to || lead.asm_id || '';
    let asmName = lead.asm_name || '';
    let asmEmployee: any = null;

    if (asmId) {
      asmEmployee = await Employee.findOne({ employee_id: asmId }).lean();
      if (asmEmployee) asmName = asmEmployee.name;
    }
    if (!asmEmployee && team) {
      asmEmployee = await Employee.findOne({
        team: new RegExp(`^${escapeRegex(team.trim())}$`, 'i'),
        $or: [
          { designation: /area sales manager/i },
          { designation: /office team lead/i },
          { employee_id: /^ASM/i },
        ],
      }).lean();
      if (asmEmployee) {
        asmId = asmEmployee.employee_id || asmId;
        asmName = asmEmployee.name || asmName;
      }
    }

    // Determine State Sales Manager (SM)
    let smEmployee: any = null;
    if (asmEmployee?.reports_to) {
      smEmployee = await Employee.findOne({ employee_id: asmEmployee.reports_to }).lean();
    }
    if (!smEmployee) {
      smEmployee = await Employee.findOne({
        $or: [
          { designation: /^(?:state\s+)?sales\s+manager$/i },
          { designation: /^state\s+manager$/i },
          { employee_id: /^SM/i },
        ],
        employee_id: { $not: /^ASM/i },
        status: 'active',
      }).lean();
    }
    const smId = smEmployee?.employee_id || 'SM001';
    const smName = smEmployee?.name || 'Sales Manager';

    const finalStudentId = existingStudentId || providedStudentId || (await getNextStudentId());
    const course = body.course || lead.interested_course || lead.course || '';
    const payment = Number(body.payment ?? body.payment_amount ?? 0);
    const paymentVerification =
      body.payment_verification || lead.payment_verification || 'Verified';
    const remarks = String(body.remarks || body.notes || lead.remarks || '').trim();

    // Check if incentive already generated for this admission
    const existingIncentive = await Incentive.findOne({
      lead_id: lead.lead_id || lead._id.toString(),
      bde_id: bdeId,
    });

    const isNewlyClosed =
      lead.admission_status !== 'Admitted' &&
      lead.admission_status !== 'Closed' &&
      lead.status !== 4 &&
      lead.status !== 5;

    // Multi-tier incentive amounts: BDE ₹1,000, ASM ₹100, SM ₹20
    const bdeIncentive = typeof bdeEmployee?.incentive === 'number' && bdeEmployee.incentive >= 0 ? bdeEmployee.incentive : 1000;
    const asmIncentive = 100;
    const smIncentive = 20;

    // Update lead document
    lead.admission_status = 'Admitted';
    lead.status = 4; // Admitted / Won
    lead.student_id = finalStudentId;
    if (course) lead.course = course;
    if (course) lead.interested_course = course;
    lead.payment_amount = payment;
    lead.payment_verification = paymentVerification;
    lead.admission_date = lead.admission_date || new Date();
    lead.incentive_amount = bdeIncentive;
    lead.incentive_earned = bdeIncentive;
    lead.incentive_status = 'Credited';
    lead.bde_id = bdeId;
    lead.bde_name = bdeName;
    lead.asm_id = asmId;
    lead.asm_name = asmName;
    lead.sm_id = smId;
    lead.sm_name = smName;
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
    await syncAllEmployeeTaskAchievements();

    // Multi-tier incentive processing: BDE ₹1,000, ASM ₹100, SM ₹20
    let incentiveRecord = existingIncentive;
    if (!existingIncentive && isNewlyClosed) {
      // 1. Record BDE Incentive
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
        amount: bdeIncentive,
        status: 'Earned',
        admission_date: new Date(),
      });

      // 2. Credit BDE Wallet (+₹1,000)
      await Wallet.findOneAndUpdate(
        {
          $or: [
            ...(bdeId ? [{ employee_id: bdeId }] : []),
            ...(bdeName ? [{ employee: new RegExp(`^${escapeRegex(bdeName.trim())}$`, 'i') }] : []),
          ],
        },
        {
          $setOnInsert: {
            employee: bdeName,
            employee_id: bdeId,
            currency: 'INR',
          },
          $inc: {
            balance: bdeIncentive,
            total_earned: bdeIncentive,
          },
        },
        { upsert: true, new: true }
      );

      // 3. Credit reporting ASM Wallet (+₹100)
      if (asmId || asmName) {
        await Wallet.findOneAndUpdate(
          {
            $or: [
              ...(asmId ? [{ employee_id: asmId }] : []),
              ...(asmName ? [{ employee: new RegExp(`^${escapeRegex(asmName.trim())}$`, 'i') }] : []),
            ],
          },
          {
            $setOnInsert: {
              employee: asmName || 'ASM',
              employee_id: asmId,
              currency: 'INR',
            },
            $inc: {
              balance: asmIncentive,
              total_earned: asmIncentive,
            },
          },
          { upsert: true, new: true }
        );

        // Record ASM incentive
        await Incentive.create({
          lead_id: lead.lead_id || lead._id.toString(),
          student_id: finalStudentId,
          student_name: lead.name,
          course,
          bde_id: asmId,
          bde_name: asmName,
          asm_id: asmId,
          asm_name: asmName,
          team,
          amount: asmIncentive,
          status: 'Earned',
          admission_date: new Date(),
        }).catch((err: any) => console.error('ASM Incentive creation notice:', err.message));
      }

      // 4. Credit State Sales Manager SM Wallet (+₹20)
      if (smId || smName) {
        await Wallet.findOneAndUpdate(
          {
            $or: [
              ...(smId ? [{ employee_id: smId }] : []),
              ...(smName ? [{ employee: new RegExp(`^${escapeRegex(smName.trim())}$`, 'i') }] : []),
            ],
          },
          {
            $setOnInsert: {
              employee: smName || 'Sales Manager',
              employee_id: smId,
              currency: 'INR',
            },
            $inc: {
              balance: smIncentive,
              total_earned: smIncentive,
            },
          },
          { upsert: true, new: true }
        );

        // Record SM incentive
        await Incentive.create({
          lead_id: lead.lead_id || lead._id.toString(),
          student_id: finalStudentId,
          student_name: lead.name,
          course,
          bde_id: smId,
          bde_name: smName,
          asm_id: asmId,
          asm_name: asmName,
          team,
          amount: smIncentive,
          status: 'Earned',
          admission_date: new Date(),
        }).catch((err: any) => console.error('SM Incentive creation notice:', err.message));
      }
    }

    await logActivity({
      description: `Admission closed for student ${lead.name} (${finalStudentId}) by ${bdeName}. Multi-tier incentives credited: ₹${bdeIncentive} to BDE ${bdeName}, ₹${asmIncentive} to ASM ${asmName || asmId}, ₹${smIncentive} to SM ${smName || smId}.`,
      subjectType: 'Admission',
      causer: causerFromRequest(req),
    });

    return NextResponse.json({
      success: true,
      message: `Lead ${lead.name} successfully closed as Admission (${finalStudentId}). Multi-tier incentives credited: ₹${bdeIncentive} to ${bdeName}, ₹${asmIncentive} to ASM ${asmName || asmId}, ₹${smIncentive} to SM ${smName || smId}.`,
      data: {
        lead_id: lead.lead_id,
        student_id: finalStudentId,
        name: lead.name,
        status: 4,
        admission_status: 'Admitted',
        incentive_earned: bdeIncentive,
        asm_incentive: asmIncentive,
        sm_incentive: smIncentive,
        incentive_id: incentiveRecord?._id?.toString() || null,
        bde: bdeName,
        asm: asmName,
        sm: smName,
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

function escapeRegex(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
