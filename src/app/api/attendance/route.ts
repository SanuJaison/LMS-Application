import { connectDB } from '@/lib/db';
import { Attendance } from '@/models/attendence';
import { nameRegex, ok, todayKey, formatHoursWorked } from '@/lib/employeeAuth';
import { requireEmployee } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/attendance
 * Today's record plus the employee's recent attendance. Own records only.
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireEmployee(req);
    if (!guard.ok) return guard.response;

    const employee = guard.auth.employee;
    const employeeId = guard.auth.employeeId;
    const nameFilter = nameRegex(employee.name);

    const queryFilter: Record<string, any> = {
      $or: [
        ...(employeeId ? [{ employee_id: employeeId }] : []),
        ...(nameFilter ? [{ name: nameFilter }] : []),
      ],
    };

    if (queryFilter.$or.length === 0) {
      return ok({ today: null, records: [] }, 'No attendance found');
    }

    const todayFilter = {
      ...queryFilter,
      date: todayKey(),
    };

    const [rawToday, rawRecords] = await Promise.all([
      Attendance.findOne(todayFilter).lean() as Promise<any>,
      Attendance.find(queryFilter).sort({ date: -1 }).limit(31).lean() as Promise<any[]>,
    ]);

    let today = rawToday;
    if (today && today.status === 'ONLINE') {
      today = { ...today, check_out: '' };
    }

    const sanitizedToday = sanitizeAttendanceRecord(today);
    const sanitizedRecords = (rawRecords || []).map(sanitizeAttendanceRecord);

    return ok({ today: sanitizedToday, records: sanitizedRecords }, 'Attendance fetched successfully');
  } catch (error: any) {
    console.error('GET /api/attendance error:', error);
    return ok({ today: null, records: [] }, 'Attendance unavailable');
  }
}

function sanitizeAttendanceRecord(r: any): any {
  if (!r) return null;
  const rawSessions = Array.isArray(r.sessions) ? r.sessions : [];
  const sanitizedSessions = rawSessions.map((s: any) => {
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
  const lat = typeof r.latitude === 'number' && !isNaN(r.latitude) ? r.latitude : 10.0159;
  const lng = typeof r.longitude === 'number' && !isNaN(r.longitude) ? r.longitude : 76.3419;
  const formattedHours = formatHoursWorked(r.hours_worked, r.check_in, r.check_out);
  return {
    ...r,
    latitude: lat,
    longitude: lng,
    location_lat: lat,
    location_lng: lng,
    hours_worked: formattedHours,
    hours_worked_formatted: formattedHours,
    sessions: sanitizedSessions,
    punches: sanitizedSessions,
  };
}
