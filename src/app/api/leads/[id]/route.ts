import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Lead } from '@/models/lead';
import {
  canAccessEmployee,
  forbidden,
  getScope,
  requireAuth,
} from '@/lib/apiAuth';
import { getNextStudentId } from '@/lib/studentId';
import { syncAllEmployeeTaskAchievements } from '@/lib/targetSync';
import {
  findLeadByAnyId,
  serializeLeadsForMobile,
} from '@/lib/mobileLead';
import { causerFromRequest, logActivity } from '@/lib/activityLog';

export async function GET(
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
      return NextResponse.json({ success: false, message: 'Lead not found' }, { status: 404 });
    }

    if (!canAccessEmployee(scope, lead.employee_id, lead.employee)) {
      return forbidden('This lead is outside your hierarchy.');
    }

    if (auth.employee) {
      const [mobile] = await serializeLeadsForMobile([lead.toObject ? lead.toObject() : lead]);
      return NextResponse.json({ success: true, data: mobile });
    }

    return NextResponse.json({
      success: true,
      data: { ...(lead.toObject ? lead.toObject() : lead), id: lead._id.toString() },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(
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
      return NextResponse.json({ success: false, message: 'Lead not found' }, { status: 404 });
    }

    if (!canAccessEmployee(scope, lead.employee_id, lead.employee)) {
      return forbidden('This lead is outside your hierarchy.');
    }

    const body = await req.json().catch(() => ({}));
    const updateData: Record<string, any> = { ...body };
    delete updateData.id;
    delete updateData._id;

    if (auth.employee) {
      delete updateData.employee;
      delete updateData.employee_id;
    }

    const rawAdm = String(updateData.admission_status ?? updateData.status ?? '').toLowerCase().trim();
    const isAdmitted =
      rawAdm === 'admitted' ||
      rawAdm === 'closed' ||
      rawAdm === 'won' ||
      rawAdm === '4' ||
      rawAdm === '5' ||
      updateData.status === 4 ||
      updateData.status === 5;

    if (isAdmitted) {
      updateData.status = 4;
      if (
        !updateData.admission_status ||
        String(updateData.admission_status) === '4' ||
        String(updateData.admission_status) === '5'
      ) {
        updateData.admission_status = 'Admitted';
      }
      if (!updateData.admission_date && !lead.admission_date) {
        updateData.admission_date = new Date();
      }
      if (!updateData.student_id && !lead.student_id) {
        updateData.student_id = await getNextStudentId();
      }
    }

    const updated = await Lead.findByIdAndUpdate(lead._id, updateData, { new: true });
    await syncAllEmployeeTaskAchievements();

    await logActivity({
      description: `Updated lead "${updated?.name}" (${updated?.lead_id})`,
      subjectType: 'Lead',
      causer: causerFromRequest(req),
    });

    if (auth.employee && updated) {
      const [mobile] = await serializeLeadsForMobile([updated.toObject()]);
      return NextResponse.json({
        success: true,
        message: 'Lead updated successfully',
        data: mobile,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Lead updated successfully',
      data: { ...updated?.toObject(), id: updated?._id.toString() },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  return PUT(req, context);
}
