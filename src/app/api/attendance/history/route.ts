import { formatHoursWorked } from '@/lib/employeeAuth';
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Attendance } from '@/models/attendence';
import { Employee } from '@/models/employee';
import {
  canAccessEmployee,
  getScope,
  requireAuth,
  scopeFilter,
  andFilter,
} from '@/lib/apiAuth';

/**
 * GET /api/attendance/history
 * Attendance for the caller and, for managers, their team.
 *   - BDE        -> own records only
 *   - ASM / BDM  -> own + direct reports
 *   - SM         -> own + whole subtree
 *   - admin      -> all (optionally narrowed with ?employee_id= / ?email=)
 *
 * Returns latest check_in and check_out times, cumulative hours worked (default 0),
 * and all sessions/punches for each day.
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const scope = await getScope(auth);

    const { searchParams } = new URL(req.url);
    const email = (searchParams.get('email') || '').trim();
    const empId = (searchParams.get('employee_id') || '').trim();
    const month = (searchParams.get('month') || '').trim(); // e.g. "2026-10"

    const filters: Record<string, any>[] = [
      scopeFilter(scope, { idFields: ['employee_id'], nameFields: ['name'] }),
    ];

    if (empId || email) {
      let target: any = null;
      if (empId) {
        target = await Employee.findOne({ employee_id: empId }).lean();
      } else {
        target = await Employee.findOne({ email: email.toLowerCase() }).lean();
      }

      if (!target) {
        return NextResponse.json(
          { success: false, message: 'Employee not found.' },
          { status: 404 }
        );
      }

      if (!canAccessEmployee(scope, target.employee_id, target.name)) {
        return NextResponse.json(
          { success: false, message: "You cannot view this employee's attendance." },
          { status: 403 }
        );
      }

      filters.push({
        $or: [
          { employee_id: target.employee_id },
          { name: new RegExp(`^${escapeRegex(target.name)}$`, 'i') },
        ],
      });
    }

    if (month) {
      filters.push({ date: new RegExp(`^${escapeRegex(month)}`) });
    }

    const records = await Attendance.find(andFilter(...filters))
      .sort({ date: -1 })
      .limit(62)
      .lean();

    const data = records.map((r: any) => {
      const fallbackSessions = r.check_in
        ? [
            {
              check_in: r.check_in,
              check_out: r.check_out || '',
              hours_worked: r.hours_worked ?? 0,
            },
          ]
        : [];
      const rawSessions = r.sessions && r.sessions.length > 0 ? r.sessions : fallbackSessions;
      const sessionList = rawSessions.map((s: any) => {
        const formatted = formatHoursWorked(s.hours_worked, s.check_in, s.check_out);
        return {
          ...s,
          check_in: s.check_in || '',
          check_out: s.check_out || '',
          hours_worked: formatted,
          hours_worked_formatted: formatted,
          latitude: typeof s.latitude === 'number' && !isNaN(s.latitude) ? s.latitude : 10.0159,
          longitude: typeof s.longitude === 'number' && !isNaN(s.longitude) ? s.longitude : 76.3419,
          location_lat: typeof s.latitude === 'number' && !isNaN(s.latitude) ? s.latitude : 10.0159,
          location_lng: typeof s.longitude === 'number' && !isNaN(s.longitude) ? s.longitude : 76.3419,
          address: s.address || '',
          notes: s.notes || '',
        };
      });

      return {
        id: r._id.toString(),
        employee_id: r.employee_id || '',
        name: r.name || '',
        date: r.date,
        check_in: r.check_in || '',
        check_out: r.check_out || '',
        hours_worked: formatHoursWorked(r.hours_worked, r.check_in, r.check_out),
        hours_worked_formatted: formatHoursWorked(r.hours_worked, r.check_in, r.check_out),
        status: r.status === 'ONLINE' ? 'ONLINE' : 'PRESENT',
        sessions: sessionList,
        punches: sessionList,
      };
    });

    return NextResponse.json({
      success: true,
      message: 'Attendance history loaded',
      count: data.length,
      data,
    });
  } catch (error: any) {
    console.error('GET /api/attendance/history error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch attendance history' },
      { status: 500 }
    );
  }
}

function escapeRegex(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
