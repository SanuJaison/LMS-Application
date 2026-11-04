import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Employee } from '@/models/employee';
import { Lead } from '@/models/lead';
import { requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/office/telecallers
 * Lists all Telecallers belonging to the Office Team with their lead metrics.
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;

    const telecallers = await Employee.find({
      $or: [
        { team: /office team/i, designation: /tele/i },
        { designation: /tele-caller/i },
        { designation: /telecaller/i },
        { employee_id: /^TC/i },
      ],
      status: 'active',
    })
      .sort({ employee_id: 1 })
      .lean();

    const tcIds = telecallers.map((t) => t.employee_id).filter(Boolean);
    const tcNames = telecallers.map((t) => t.name).filter(Boolean);

    const leads = await Lead.find({
      $or: [
        { employee_id: { $in: tcIds } },
        { employee: { $in: tcNames } },
        { team: /office team/i },
      ],
    }).lean();

    const data = telecallers.map((tc) => {
      const tcLeads = leads.filter(
        (l: any) =>
          (l.employee_id && l.employee_id.toLowerCase() === tc.employee_id?.toLowerCase()) ||
          (l.employee && l.employee.toLowerCase() === tc.name?.toLowerCase())
      );
      const closed = tcLeads.filter(
        (l: any) =>
          l.admission_status === 'Admitted' ||
          l.admission_status === 'Closed' ||
          l.status === 4 ||
          l.status === 5
      );

      return {
        id: tc._id.toString(),
        employee_id: tc.employee_id,
        name: tc.name,
        email: tc.email,
        contact_number: tc.contact_number,
        designation: tc.designation || 'Tele-caller',
        team: tc.team || 'Office Team',
        zone: tc.zone || 'Central Zone',
        district: tc.district || 'Ernakulam',
        reports_to: tc.reports_to || '',
        salary: tc.salary ?? 0,
        incentive: tc.incentive ?? 0,
        leads_assigned: tcLeads.length,
        admissions_closed: closed.length,
        conversion_rate:
          tcLeads.length > 0 ? `${Math.round((closed.length / tcLeads.length) * 100)}%` : '0%',
        status: tc.status || 'active',
      };
    });

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error: any) {
    console.error('GET /api/office/telecallers error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to list telecallers' },
      { status: 500 }
    );
  }
}
