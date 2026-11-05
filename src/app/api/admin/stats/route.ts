import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';
import { Lead } from '@/models/lead';
import { Employee } from '@/models/employee';
import { Attendance } from '@/models/attendence';

const STATUS_LABELS = [
  'New',
  'Contacted',
  'Interested',
  'Follow Up',
  'Won / Admitted',
  'Lost / Closed',
];
const STATUS_COLORS = ['#09929e', '#8b5cf6', '#f59e0b', '#f97316', '#10b981', '#ef4444'];

/**
 * Map the admin string statuses and the mobile numeric statuses onto the
 * dashboard's six buckets. Returns -1 for values that should not be counted.
 */
function statusIndex(status: any): number {
  const raw = String(status ?? '').trim().toLowerCase();
  if (raw === '') return 0;

  // String statuses (admin lead form)
  if (raw.includes('won') || raw.includes('admit') || raw.includes('enroll')) return 4;
  if (
    raw.includes('lost') ||
    raw.includes('closed') ||
    raw.includes('reject') ||
    raw.includes('not interested')
  ) {
    return 5;
  }
  if (raw.includes('follow')) return 3;
  if (raw.includes('present') || raw.includes('schedul') || raw.includes('payment pending')) {
    return 2;
  }
  if (raw.includes('interest')) return 2;
  if (raw.includes('contact')) return 1;
  if (raw.includes('new')) return 0;

  // Numeric statuses (mobile app)
  const numeric = Number(status);
  if (!Number.isNaN(numeric)) {
    if (numeric === 4) return 4;
    if (numeric === 5) return 5;
    if (numeric === 3) return 2;
    if (numeric === 2) return 3;
    if (numeric === 1) return 0;
  }

  return -1;
}

/**
 * GET /api/admin/stats - Live Dashboard Analytics (admin only)
 *
 * Every number below is derived from MongoDB. There are no placeholder or
 * seeded fallback values, so an empty database renders an empty dashboard.
 */
export async function GET(req: Request) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;

    await connectDB();
    const { searchParams } = new URL(req.url);
    const zone = searchParams.get('zone');
    const district = searchParams.get('district');

    const now = new Date();
    const todayKey = now.toISOString().split('T')[0];
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // Filter queries
    const leadQuery: Record<string, any> = {};
    const empQuery: Record<string, any> = {};

    if (district && district !== 'All Districts') {
      leadQuery.district = district;
      empQuery.district = district;
    }
    if (zone && zone !== 'All Zones') {
      empQuery.zone = zone;
    }

    const employees = await Employee.find(empQuery).select('employee_id').lean();
    const employeeIds = employees
      .map((emp: any) => emp.employee_id)
      .filter((id: any): id is string => Boolean(id));

    const attendanceQuery: Record<string, any> = { date: todayKey };
    if (district && district !== 'All Districts') {
      attendanceQuery.district = district;
    }
    if (zone && zone !== 'All Zones') {
      attendanceQuery.employee_id = { $in: employeeIds };
    }

    const [totalLeads, newLeadsToday, statusAgg, districtAgg, monthAgg, attendanceRecords, onlineNow] =
      await Promise.all([
        Lead.countDocuments(leadQuery),
        Lead.countDocuments({ ...leadQuery, createdAt: { $gte: startOfToday } }),
        Lead.aggregate([
          { $match: leadQuery },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        Lead.aggregate([
          { $match: leadQuery },
          { $group: { _id: '$district', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        Lead.aggregate([
          { $match: { ...leadQuery, createdAt: { $gte: sixMonthsAgo } } },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
              },
              count: { $sum: 1 },
              statuses: { $push: '$status' },
            },
          },
        ]),
        Attendance.find(attendanceQuery).sort({ createdAt: -1 }).limit(10).lean(),
        Attendance.countDocuments({ ...attendanceQuery, status: 'ONLINE' }),
      ]);

    const totalEmployees = employees.length;

    // Leads by status buckets
    const statusCounts = STATUS_LABELS.map(() => 0);
    statusAgg.forEach((row: any) => {
      const idx = statusIndex(row._id);
      if (idx >= 0 && idx < statusCounts.length) {
        statusCounts[idx] += row.count || 0;
      }
    });

    // Last six months, newest last
    const months = Array.from({ length: 6 }, (_, idx) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
      return {
        label: date.toLocaleString('en-US', { month: 'short' }),
        year: date.getFullYear(),
        month: date.getMonth() + 1,
      };
    });

    const monthMap = new Map<string, { created: number; won: number }>();
    monthAgg.forEach((row: any) => {
      const key = `${row._id?.year}-${row._id?.month}`;
      const won = (row.statuses || []).filter((status: any) => statusIndex(status) === 4).length;
      const entry = monthMap.get(key) || { created: 0, won: 0 };
      entry.created += row.count || 0;
      entry.won += won;
      monthMap.set(key, entry);
    });

    const trend = months.map((month) => {
      const key = `${month.year}-${month.month}`;
      return monthMap.get(key) || { created: 0, won: 0 };
    });

    // Leads by district (skip blank districts)
    const districtRows = districtAgg.filter(
      (row: any) => row._id && String(row._id).trim() !== ''
    );

    const data = {
      totalLeads,
      newLeadsToday,
      activeFieldForce: `${onlineNow}/${totalEmployees} Active`,
      totalEmployees,
      leadsByStatus: {
        labels: STATUS_LABELS,
        data: statusCounts,
        colors: STATUS_COLORS,
      },
      leadGenerationTrend: {
        months: months.map((month) => month.label),
        data: trend.map((month) => month.created),
        wonData: trend.map((month) => month.won),
      },
      leadsByDistrict: {
        labels: districtRows.map((row: any) => String(row._id)),
        data: districtRows.map((row: any) => row.count || 0),
      },
      liveAttendance: attendanceRecords.map((a: any) => ({
        id: a._id.toString(),
        name: a.name,
        designation: a.designation || '—',
        district: a.district || '—',
        date: a.date || '',
        check_in: a.check_in || '—',
        check_out: a.check_out || '—',
        hours_worked: a.hours_worked ?? '—',
        status: a.status || 'OFFLINE',
      })),
    };

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
