import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Employee } from '@/models/employee';
import { Lead } from '@/models/lead';
import { Attendance } from '@/models/attendence';
import { Wallet } from '@/models';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';
import { hierarchyRole } from '@/lib/hierarchy';
import { numericId, todayKey } from '@/lib/employeeAuth';

/**
 * GET /api/home
 * Main Dashboard Feed endpoint for the mobile app (HomeDashboardModel).
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const token = extractTokenFromHeader(req);
    const decoded = token ? verifyToken(token) : null;

    let employee: any = null;
    if (decoded?.role === 'employee' && decoded.id) {
      employee = await Employee.findById(decoded.id).lean();
    }

    if (!employee) {
      // Fallback
      const { searchParams } = new URL(req.url);
      const email = searchParams.get('email');
      const empId = searchParams.get('employee_id');

      if (email || empId) {
        employee = await Employee.findOne({
          $or: [
            ...(email ? [{ email: email.toLowerCase() }] : []),
            ...(empId ? [{ employee_id: empId }] : []),
          ],
        }).lean();
      } else {
        employee = await Employee.findOne({ status: 'active' }).lean();
      }
    }

    const employeeName = employee?.name || 'Employee';
    const employeeId = employee?.employee_id || 'EMP001';
    const role = employee ? hierarchyRole(employee) : 'BDE';
    const designationName =
      employee?.designation || (role === 'ASM' ? 'Area Sales Manager' : 'Business Development Executive');
    const teamName = employee?.team || 'TVM Team';

    const empNumericId = numericId(employee?._id) || 101;

    // 1. Attendance Today
    const today = todayKey();
    const todayAtt: any = await Attendance.findOne({
      $or: [
        { employee_id: employeeId, date: today },
        { name: new RegExp(`^${employeeName.trim()}$`, 'i'), date: today },
      ],
    }).lean();

    const isCheckedIn = Boolean(todayAtt && todayAtt.check_in && !todayAtt.check_out);
    const checkInTime = todayAtt?.check_in || '--:--';
    const checkOutTime = todayAtt?.check_out || '--:--';
    const shiftStatus = todayAtt ? (isCheckedIn ? 'ONLINE' : 'COMPLETED') : 'NOT_STARTED';

    // 2. Leads & Performance
    const leadQuery: Record<string, any> = {};
    if (role === 'BDE') {
      leadQuery.$or = [
        { employee_id: employeeId },
        { employee: new RegExp(`^${employeeName.trim()}$`, 'i') },
      ];
    } else if (role === 'ASM') {
      leadQuery.$or = [{ asm_id: employeeId }, { team: teamName }];
    }

    const allLeads = await Lead.find(leadQuery).lean();

    const assignedLeads = allLeads.length;
    const followUpLeads = allLeads.filter(
      (l: any) =>
        l.admission_status === 'Follow-up' ||
        l.admission_status === 'Interested' ||
        l.status === 2 ||
        l.status === 3
    ).length;
    const closedLeads = allLeads.filter(
      (l: any) =>
        l.admission_status === 'Admitted' ||
        l.admission_status === 'Closed' ||
        l.status === 4 ||
        l.status === 5
    ).length;

    // 3. Wallet / Incentives
    const wallet: any = await Wallet.findOne({
      $or: [
        { employee_id: employeeId },
        { employee: new RegExp(`^${employeeName.trim()}$`, 'i') },
      ],
    }).lean();

    const incentivesEarned = wallet?.total_earned ?? closedLeads * 1000;

    // 4. Subordinate BDE Status (if manager / ASM)
    let subordinateList: any[] = [];
    if (role === 'ASM' || role === 'SM') {
      const bdes: any[] = await Employee.find({
        $or: [
          { reports_to: employeeId },
          { team: teamName, designation: /business development executive/i },
        ],
      }).lean();

      subordinateList = bdes.map((bde) => {
        const bdeLeads = allLeads.filter((l: any) => l.employee_id === bde.employee_id);
        const bdeClosed = bdeLeads.filter(
          (l: any) =>
            l.admission_status === 'Admitted' ||
            l.admission_status === 'Closed' ||
            l.status === 4
        ).length;
        const conv =
          bdeLeads.length > 0 ? Math.round((bdeClosed / bdeLeads.length) * 100) : 0;

        return {
          id: numericId(bde._id) || 1,
          name: bde.name,
          designation: bde.designation || 'Business Development Executive',
          conversion_percentage: `${conv}%`,
          leads_assigned: `${bdeLeads.length}`,
          online_status: bde.status === 'active' ? 'ONLINE' : 'OFFLINE',
          online_time: '09:00 AM',
          location_lat: 10.0159,
          location_lng: 76.3419,
        };
      });
    }

    const conversionRate =
      assignedLeads > 0 ? Math.round((closedLeads / assignedLeads) * 100) : 0;

    const payload = {
      user: {
        id: empNumericId,
        name: employeeName,
        email: employee?.email || '',
      },
      designation_id: role === 'ASM' ? 401 : role === 'SM' ? 301 : 501,
      designation_name: designationName,
      attendance: {
        check_in_time: checkInTime,
        check_out_time: checkOutTime,
        shift_status: shiftStatus,
        is_checked_in: isCheckedIn,
        location_lat: todayAtt?.latitude ?? 10.0159,
        location_lng: todayAtt?.longitude ?? 76.3419,
      },
      eod_sync: {
        tasks_completed: closedLeads,
        total_tasks: Math.max(assignedLeads, 15),
        completion_percentage: conversionRate,
      },
      operational_overview: {
        assigned_leads: assignedLeads,
        follow_up_leads: followUpLeads,
        closed_leads: closedLeads,
        incentives_earned: incentivesEarned,
      },
      dashboard_type: role === 'ASM' ? 'asm' : role === 'SM' ? 'sm' : 'bde',
      team_name: teamName,
      team_metrics: {
        team_leads: assignedLeads,
        team_admissions: closedAdmissionsCount(allLeads),
        team_conversion: `${conversionRate}%`,
        visits_pending: followUpLeads,
      },
      team_subordinate_status: {
        bdes: subordinateList,
      },
      territory_report: [
        {
          district_name: employee?.district || 'Ernakulam',
          target: 100,
          achieved: closedLeads,
          growth_rate: '+12.5%',
        },
      ],
    };

    return NextResponse.json({
      success: true,
      message: 'Home dashboard data loaded',
      data: payload,
    });
  } catch (error: any) {
    console.error('GET /api/home error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to load home dashboard' },
      { status: 500 }
    );
  }
}

function closedAdmissionsCount(leads: any[]): number {
  return leads.filter(
    (l) =>
      l.admission_status === 'Admitted' ||
      l.admission_status === 'Closed' ||
      l.status === 4 ||
      l.status === 5
  ).length;
}
