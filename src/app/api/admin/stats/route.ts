import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';
import { todayKey } from '@/lib/employeeAuth';
import { Lead } from '@/models/lead';
import { Employee } from '@/models/employee';
import { Attendance } from '@/models/attendence';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/stats - Live Dynamic Dashboard Analytics (Strictly from MongoDB Atlas)
 *
 * Filters:
 *   ?zone=      employee zone; leads are matched through their assigned employee
 *   ?district=  employee/lead district
 *
 * Every number is recomputed for the selected slice of the business.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** IST calendar parts for a stored timestamp. */
function istParts(value: any): { year: number; month: number; day: number } | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

function istDateKey(value: any): string {
  const parts = istParts(value);
  return parts ? `${parts.year}-${pad(parts.month + 1)}-${pad(parts.day)}` : '';
}

function istMonthKey(value: any): string {
  const parts = istParts(value);
  return parts ? `${parts.year}-${pad(parts.month + 1)}` : '';
}

function normalizeName(value: any): string {
  return String(value || '').trim().toLowerCase();
}

function isWon(lead: any): boolean {
  const st = String(lead.status || lead.admission_status || '').toLowerCase();
  return st.includes('admit') || st.includes('won') || lead.status === 4 || lead.status === 5;
}

export async function GET(req: Request) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;

    await connectDB();
    const { searchParams } = new URL(req.url);

    const rawZone = searchParams.get('zone');
    const rawDistrict = searchParams.get('district');
    const zone = rawZone && rawZone !== 'All Zones' ? rawZone : '';
    const district = rawDistrict && rawDistrict !== 'All Districts' ? rawDistrict : '';
    const filterActive = Boolean(zone || district);

    // 1. Employees inside the selected zone/district slice
    const empQuery: Record<string, any> = {};
    if (district) empQuery.district = district;
    if (zone) empQuery.zone = zone;

    const employees: any[] = await Employee.find(empQuery)
      .select('name employee_id designation district zone')
      .lean();

    const totalEmployees = employees.length;

    const employeeNames: string[] = [];
    const employeeIds: string[] = [];
    const employeeByName = new Map<string, any>();

    employees.forEach((emp) => {
      if (emp.name) {
        employeeNames.push(emp.name);
        employeeByName.set(normalizeName(emp.name), emp);
      }
      if (emp.employee_id) employeeIds.push(String(emp.employee_id));
    });

    const allowedNames = new Set<string>(employeeNames.map(normalizeName));

    // 2. Leads for the slice. Leads only carry `district` and the assigned
    //    employee, so a zone filter is resolved through the employee list.
    const leadConditions: Record<string, any>[] = [];
    if (district) leadConditions.push({ district });
    if (zone) {
      leadConditions.push({
        $or: [{ employee: { $in: employeeNames } }, { employee_id: { $in: employeeIds } }],
      });
    }
    const leadQuery: Record<string, any> = leadConditions.length
      ? { $and: leadConditions }
      : {};

    const [totalLeads, allLeads] = await Promise.all([
      Lead.countDocuments(leadQuery),
      Lead.find(leadQuery).lean(),
    ]);

    // 3. New leads generated today (IST calendar day)
    const today = todayKey();
    const newLeadsToday = (allLeads as any[]).filter(
      (l) => istDateKey(l.createdAt || l.updatedAt) === today
    ).length;

    // 4. Leads by status
    let newCount = 0;
    let contactedCount = 0;
    let interestedCount = 0;
    let followUpCount = 0;
    let wonCount = 0;
    let lostCount = 0;

    (allLeads as any[]).forEach((l: any) => {
      const st = String(l.status || l.admission_status || '').toLowerCase();
      if (st.includes('admit') || st.includes('won') || l.status === 4 || l.status === 5) {
        wonCount++;
      } else if (st.includes('lost') || st.includes('drop') || st.includes('reject')) {
        lostCount++;
      } else if (st.includes('follow') || st.includes('present') || Boolean(l.next_followup_date)) {
        followUpCount++;
      } else if (st.includes('interest') || st.includes('progress') || l.status === 3) {
        interestedCount++;
      } else if (st.includes('contact') || l.status === 2) {
        contactedCount++;
      } else {
        newCount++;
      }
    });

    const statusLabels = ['New Leads', 'Contacted', 'Interested', 'Follow Up', 'Won / Admitted', 'Lost'];
    const statusData = [newCount, contactedCount, interestedCount, followUpCount, wonCount, lostCount];
    const statusColors = ['#09929e', '#8b5cf6', '#f59e0b', '#38bdf8', '#10b981', '#f43f5e'];

    // 5. Lead generation trend for the last 6 IST months
    const nowParts = istParts(new Date())!;
    const trendMonths: string[] = [];
    const trendData: number[] = [];
    const trendWonData: number[] = [];
    const trendKeys: string[] = [];

    for (let i = 5; i >= 0; i--) {
      const bucket = new Date(Date.UTC(nowParts.year, nowParts.month - i, 1));
      const key = `${bucket.getUTCFullYear()}-${pad(bucket.getUTCMonth() + 1)}`;
      trendKeys.push(key);
      trendMonths.push(MONTH_NAMES[bucket.getUTCMonth()]);
    }

    trendKeys.forEach((key) => {
      const monthlyLeads = (allLeads as any[]).filter(
        (l) => istMonthKey(l.createdAt || l.updatedAt) === key
      );
      trendData.push(monthlyLeads.length);
      trendWonData.push(monthlyLeads.filter(isWon).length);
    });

    // 6. Leads by district - every district that has leads, highest first
    const districtTally: Record<string, number> = {};
    (allLeads as any[]).forEach((l: any) => {
      const d = String(l.district || '').trim() || 'Unassigned';
      districtTally[d] = (districtTally[d] || 0) + 1;
    });

    const sortedDistricts = Object.entries(districtTally).sort((a, b) => b[1] - a[1]);

    // 7. Live attendance: today only, one row per employee (latest record wins)
    const todayAttendance: any[] = await Attendance.find({ date: today })
      .sort({ createdAt: -1 })
      .lean();

    const seenEmployees = new Set<string>();
    const dedupedAttendance: any[] = [];

    (todayAttendance as any[]).forEach((record: any) => {
      const key = normalizeName(record.name);
      if (!key || seenEmployees.has(key)) return;
      seenEmployees.add(key);

      // Attendance has no zone/district columns; join through the employee name.
      if (filterActive && !allowedNames.has(key)) return;

      dedupedAttendance.push(record);
    });

    const onlineAttendance = dedupedAttendance.filter((a: any) => a.status === 'ONLINE').length;
    const activeFieldForce = `${onlineAttendance} / ${totalEmployees} Active`;

    const liveAttendance = dedupedAttendance.map((a: any) => {
      const employee = employeeByName.get(normalizeName(a.name));
      return {
        id: a._id.toString(),
        name: a.name || 'Field Staff',
        designation: a.designation || employee?.designation || 'Field Executive',
        district: a.district || employee?.district || 'Ernakulam',
        date: a.date || today,
        check_in: a.check_in || '',
        check_out: a.check_out || '',
        hours_worked: a.hours_worked || 0,
        status: a.status || 'OFFLINE',
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        totalLeads,
        newLeadsToday,
        activeFieldForce,
        totalEmployees,
        leadsByStatus: {
          labels: statusLabels,
          data: statusData,
          colors: statusColors,
        },
        leadGenerationTrend: {
          months: trendMonths,
          data: trendData,
          wonData: trendWonData,
        },
        leadsByDistrict: {
          labels: sortedDistricts.map(([name]) => name),
          data: sortedDistricts.map(([, count]) => count),
        },
        liveAttendance,
        attendancePreview: liveAttendance,
      },
    });
  } catch (error: any) {
    console.error('Error fetching dynamic dashboard stats:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
