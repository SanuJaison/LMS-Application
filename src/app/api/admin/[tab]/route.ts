import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';
import { causerFromRequest, logActivity } from '@/lib/activityLog';
import { teamNamesFromTeams } from '@/lib/hierarchy';
import { getNextStudentId } from '@/lib/studentId';
import bcrypt from 'bcryptjs';
import {
  Lead,
  Employee,
  Attendance,
  Zone,
  District,
  Course,
  Designation,
  Team,
  Task,
  TaskTemplate,
  EmployeeTask,
  Wallet,
  Leave,
  ActivityLog,
  WalletWithdrawRequest,
  Role,
  Setting,
} from '@/models';

// Map URL tab names to their Mongoose models
const models: Record<string, any> = {
  leads: Lead,
  employees: Employee,
  attendance: Attendance,
  attendanceRecords: Attendance,
  zones: Zone,
  districts: District,
  courses: Course,
  designations: Designation,
  teams: Team,
  tasks: Task,
  taskTemplates: TaskTemplate,
  'task-templates': TaskTemplate,
  employeeTasks: EmployeeTask,
  'employee-tasks': EmployeeTask,
  wallets: Wallet,
  walletWithdrawRequests: WalletWithdrawRequest,
  'wallet-withdraw-requests': WalletWithdrawRequest,
  walletWithdrawRequest: WalletWithdrawRequest,
  leaves: Leave,
  activities: ActivityLog,
  roles: Role,
  settings: Setting,
};

// Helper to format payload before saving/updating
function cleanData(tab: string, body: any) {
  const data = { ...body };

  if (tab === 'employees') {
    if (!data.employee_id) data.employee_id = `EMP-${Date.now().toString().slice(-4)}`;
    if (data.phone && !data.contact_number) data.contact_number = data.phone;
    if (!data.email && data.contact?.includes('@')) data.email = data.contact;
    if (data.status) data.status = data.status.toLowerCase();
    if (data.reports_to) data.reports_to = String(data.reports_to).trim().toUpperCase();
    if (data.reports_to === data.employee_id) data.reports_to = '';

    // Hash the employee password; never store it in plain text.
    // On update an empty password means "keep the existing one".
    if (typeof data.password === 'string' && data.password.trim()) {
      data.password = bcrypt.hashSync(data.password.trim(), 10);
    } else {
      delete data.password;
    }
  }

  if (tab === 'leads') {
    if (!data.lead_id) {
      data.lead_id = `LD-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    // Synchronize contact numbers
    if (data.contact && !data.phone) data.phone = data.contact;
    if (data.contact_number && !data.phone) data.phone = data.contact_number;
    if (data.phone && !data.contact_number) data.contact_number = data.phone;
    if (data.whats_number && !data.whatsapp_number) data.whatsapp_number = data.whats_number;
    if (data.whatsapp_number && !data.whats_number) data.whats_number = data.whatsapp_number;

    // Synchronize courses
    if (data.interested_course && !data.course) data.course = data.interested_course;
    if (data.course && !data.interested_course) data.interested_course = data.course;

    // Synchronize sources
    if (data.lead_source && !data.source) data.source = data.lead_source;
    if (data.source && !data.lead_source) data.lead_source = data.source;

    // Synchronize status
    if (data.admission_status && !data.status) data.status = data.admission_status;
    if (data.status && !data.admission_status) data.admission_status = String(data.status);
    if (!data.status) {
      data.status = 'New';
      data.admission_status = 'New';
    }

    // Auto-generate Student ID upon admission if missing
    const isAdmitted =
      data.admission_status === 'Admitted' ||
      data.admission_status === 'Won' ||
      data.status === 'Won' ||
      data.status === 4;
    if (isAdmitted && !data.student_id) {
      data.student_id = `STU-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // Synchronize notes and remarks
    if (data.remarks && !data.notes) data.notes = data.remarks;
    if (data.notes && !data.remarks) data.remarks = data.notes;
  }

  if (tab === 'attendance' || tab === 'attendanceRecords') {
    if (!data.date) data.date = new Date().toISOString().split('T')[0];
    if (data.status) data.status = data.status.toUpperCase();
  }

  if (tab === 'teams') {
    // A team covers 0 districts (office team) or 1-2 field districts.
    // Only rebuild when the request actually carries district data, so a partial
    // update (e.g. renaming a team) never clears its districts.
    if ('districts' in data || 'district' in data) {
      const raw = Array.isArray(data.districts)
        ? data.districts
        : data.district
          ? [data.district]
          : [];
      const districts = Array.from(
        new Set(raw.map((d: any) => String(d || '').trim()).filter(Boolean))
      );
      data.districts = districts.slice(0, 2);
      data.district = data.districts[0] || '';
    }
    if (data.is_office || (Array.isArray(data.districts) && data.districts.length === 0)) {
      data.is_office = true;
      data.zone = '';
    } else {
      if (!data.zone) data.zone = 'Central Zone';
    }
  }

  if (tab === 'leaves') {
    if (!data.status) data.status = 'Pending';
  }

  if (
    tab === 'walletWithdrawRequests' ||
    tab === 'wallet-withdraw-requests' ||
    tab === 'walletWithdrawRequest'
  ) {
    if (!data.employee && data.name) data.employee = data.name;
    if (!data.name && data.employee) data.name = data.employee;
    if (!data.title && data.name) data.title = data.name;
    if (!data.status) data.status = 'Active';
  }

  if (tab === 'roles') {
    if (!data.name && data.title) data.name = data.title;
  }

  return data;
}

/**
 * A district can belong to only one team. Returns the conflicting team, or null.
 * `ignoreId` lets a team keep the districts it already owns while being edited.
 */
async function teamDistrictConflict(
  districts: string[],
  ignoreId?: string
): Promise<{ district: string; team: string } | null> {
  if (!Array.isArray(districts) || districts.length === 0) return null;

  const query =
    ignoreId && /^[0-9a-fA-F]{24}$/.test(ignoreId) ? { _id: { $ne: ignoreId } } : {};
  const others: any[] = await Team.find(query).lean();

  for (const team of others) {
    const taken = new Set(
      [...(Array.isArray(team.districts) ? team.districts : []), team.district || '']
        .map((d: any) => String(d || '').trim().toLowerCase())
        .filter(Boolean)
    );

    for (const district of districts) {
      if (taken.has(String(district).trim().toLowerCase())) {
        return { district: String(district).trim(), team: team.name || 'another team' };
      }
    }
  }

  return null;
}

function teamConflictResponse(conflict: { district: string; team: string }) {
  return NextResponse.json(
    {
      success: false,
      message: `${conflict.district} is already assigned to "${conflict.team}". A district can belong to only one team.`,
    },
    { status: 400 }
  );
}

/** An employee is an ASM when the ID is ASM-prefixed or the designation says so. */
function isAsmEmployee(employee: any): boolean {
  const id = String(employee?.employee_id || '').trim().toUpperCase();
  const designation = String(employee?.designation || '').trim().toLowerCase();
  return id.startsWith('ASM') || designation.includes('area sales manager');
}

function isSmEmployee(employee: any): boolean {
  const id = String(employee?.employee_id || '').trim().toUpperCase();
  const designation = String(employee?.designation || '').trim().toLowerCase();
  if (designation.includes('area sales manager')) return false;
  return id.startsWith('SM') || designation.includes('sales manager') || designation.includes('state manager');
}

/**
 * Field teams need exactly 2 districts and an ASM team lead; the office team
 * (no districts) needs no district, no zone, and a Sales Manager (SM) as lead.
 */
async function teamValidationProblem(
  districts: string[],
  teamLead: string,
  ignoreId?: string
): Promise<string | null> {
  const list = Array.isArray(districts)
    ? districts.map((d) => String(d || '').trim()).filter(Boolean)
    : [];
  const lead = String(teamLead || '').trim();

  const employees: any[] = await Employee.find({})
    .select('employee_id name designation')
    .lean();

  if (list.length === 0) {
    if (lead) {
      const match = employees.find(
        (e) => String(e.name || '').trim().toLowerCase() === lead.toLowerCase()
      );
      if (!match || !isSmEmployee(match)) {
        return 'Office team lead must be a Sales Manager (SM).';
      }
    }
    return null;
  }

  if (list.length !== 2) {
    return 'A field team must have exactly 2 districts (or none for the office team).';
  }

  if (!lead) return 'Team lead is required for a field team.';

  const match = employees.find(
    (e) => String(e.name || '').trim().toLowerCase() === lead.toLowerCase()
  );
  if (!match || !isAsmEmployee(match)) {
    return 'Team lead must be an Area Sales Manager (ASM).';
  }

  const query =
    ignoreId && /^[0-9a-fA-F]{24}$/.test(ignoreId) ? { _id: { $ne: ignoreId } } : {};
  const others: any[] = await Team.find(query).lean();
  const owner = others.find(
    (t) => String(t.team_lead || '').trim().toLowerCase() === lead.toLowerCase()
  );
  if (owner) return `${lead} is already the team lead of "${owner.name}".`;

  return null;
}

// Human-readable labels used by the Activities audit trail.
const ACTIVITY_LABELS: Record<string, { noun: string; subject: string }> = {
  leads: { noun: 'lead', subject: 'Lead' },
  employees: { noun: 'employee', subject: 'Employee' },
  attendance: { noun: 'attendance record', subject: 'Attendance' },
  attendanceRecords: { noun: 'attendance record', subject: 'Attendance' },
  zones: { noun: 'zone', subject: 'Zone' },
  districts: { noun: 'district', subject: 'District' },
  courses: { noun: 'course', subject: 'Course' },
  designations: { noun: 'designation', subject: 'Designation' },
  teams: { noun: 'team', subject: 'Team' },
  tasks: { noun: 'task', subject: 'Task' },
  taskTemplates: { noun: 'task template', subject: 'Task' },
  'task-templates': { noun: 'task template', subject: 'Task' },
  employeeTasks: { noun: 'employee task', subject: 'Task' },
  'employee-tasks': { noun: 'employee task', subject: 'Task' },
  wallets: { noun: 'wallet', subject: 'Wallet' },
  walletWithdrawRequests: { noun: 'withdrawal request', subject: 'Wallet' },
  'wallet-withdraw-requests': { noun: 'withdrawal request', subject: 'Wallet' },
  walletWithdrawRequest: { noun: 'withdrawal request', subject: 'Wallet' },
  leaves: { noun: 'leave', subject: 'Leave' },
  roles: { noun: 'role', subject: 'Role' },
  settings: { noun: 'setting', subject: 'Setting' },
};

function activityLabel(tab: string) {
  return ACTIVITY_LABELS[tab] || { noun: 'record', subject: 'General' };
}

/** Best available human name for a saved document. */
function recordName(doc: any): string {
  if (!doc) return '';
  return String(
    doc.name || doc.title || doc.employee || doc.lead_id || doc.description || ''
  ).trim();
}

// 1. GET: Fetch all records for a tab
export async function GET(req: Request, { params }: { params: { tab: string } }) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;

    await connectDB();
    const Model = models[params.tab];

    if (!Model) {
      return NextResponse.json({ success: false, message: 'Invalid tab category' }, { status: 400 });
    }

    const sortOrder: any =
      params.tab === 'employees' ||
      params.tab === 'teams' ||
      params.tab === 'zones' ||
      params.tab === 'wallets' ||
      params.tab === 'leaves' ||
      params.tab === 'employeeTasks' ||
      params.tab === 'taskTemplates' ||
      params.tab === 'leads' ||
      params.tab === 'walletWithdrawRequests' ||
      params.tab === 'roles' ||
      params.tab === 'settings'
        ? { createdAt: 1 }
        : { createdAt: -1 };
    const docs = await Model.find().sort(sortOrder).lean();
    let data = docs.map((doc: any) => ({ ...doc, id: doc._id.toString() }));

    // The employee `team` is derived from the Teams assignment (team lead),
    // not stored on the employee record.
    if (params.tab === 'employees') {
      const teams = (await Team.find({}, { name: 1, team_lead: 1 }).lean()) as any[];
      const teamMap = teamNamesFromTeams(docs as any[], teams);
      data = data.map((row: any) => ({
        ...row,
        team: teamMap.get(String(row.employee_id || '').trim().toUpperCase()) || '',
      }));
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// 2. POST: Create a new record
export async function POST(req: Request, { params }: { params: { tab: string } }) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;

    await connectDB();
    const Model = models[params.tab];

    if (!Model) {
      return NextResponse.json({ success: false, message: 'Invalid tab category' }, { status: 400 });
    }

    const body = await req.json();
    const payload = cleanData(params.tab, body);

    if (params.tab === 'leads') {
      const assignedEmp = String(payload.employee || payload.assigned_to || '').trim();
      if (!assignedEmp || assignedEmp.toLowerCase() === 'unassigned' || assignedEmp.toLowerCase() === 'aslam') {
        return NextResponse.json(
          { success: false, message: 'Validation failed: Assigned employee is required.' },
          { status: 400 }
        );
      }
      if (!payload.student_id) {
        payload.student_id = await getNextStudentId();
      }
      if (!payload.lead_id) {
        payload.lead_id = `LD-${Math.floor(1000 + Math.random() * 9000)}`;
      }
    }

    if (params.tab === 'teams') {
      const conflict = await teamDistrictConflict(payload.districts || []);
      if (conflict) return teamConflictResponse(conflict);

      const problem = await teamValidationProblem(
        payload.districts || [],
        payload.team_lead || ''
      );
      if (problem) {
        return NextResponse.json({ success: false, message: problem }, { status: 400 });
      }
    }

    const created = await Model.create(payload);

    if (params.tab !== 'activities') {
      const { noun, subject } = activityLabel(params.tab);
      const name = recordName(created as any);
      await logActivity({
        description: `Created ${noun}${name ? ` "${name}"` : ''}`,
        subjectType: subject,
        causer: causerFromRequest(req),
      });
    }

    if (params.tab === 'leads') {
      return NextResponse.json(
        {
          success: true,
          message: 'Lead created successfully. Note: Official endpoint is http://localhost:3000/api/leads/create',
          endpoint: '/api/leads/create',
          data: created,
        },
        { status: 201 }
      );
    }

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// 3. PUT: Update an existing record
export async function PUT(req: Request, { params }: { params: { tab: string } }) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;

    await connectDB();
    const Model = models[params.tab];

    if (!Model) {
      return NextResponse.json({ success: false, message: 'Invalid tab category' }, { status: 400 });
    }

    const body = await req.json();
    const id = body.id || body._id;

    if (!id) {
      return NextResponse.json({ success: false, message: 'Record ID is required' }, { status: 400 });
    }

    const payload = cleanData(params.tab, body);

    if (params.tab === 'teams') {
      const existing: any = await Team.findById(id).lean();

      const districts =
        payload.districts !== undefined
          ? payload.districts
          : existing?.districts?.length
            ? existing.districts
            : existing?.district
              ? [existing.district]
              : [];
      const teamLead =
        payload.team_lead !== undefined ? payload.team_lead : existing?.team_lead || '';

      const conflict = await teamDistrictConflict(districts || [], String(id));
      if (conflict) return teamConflictResponse(conflict);

      const problem = await teamValidationProblem(
        districts || [],
        teamLead,
        String(id)
      );
      if (problem) {
        return NextResponse.json({ success: false, message: problem }, { status: 400 });
      }
    }

    const updated = await Model.findByIdAndUpdate(id, payload, { new: true });

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Record not found' }, { status: 404 });
    }

    if (params.tab !== 'activities') {
      const { noun, subject } = activityLabel(params.tab);
      const name = recordName(updated as any);
      await logActivity({
        description: `Updated ${noun}${name ? ` "${name}"` : ''}`,
        subjectType: subject,
        causer: causerFromRequest(req),
      });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// 4. DELETE: Delete record(s) by ID
export async function DELETE(req: Request, { params }: { params: { tab: string } }) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;

    await connectDB();
    const Model = models[params.tab];

    if (!Model) {
      return NextResponse.json({ success: false, message: 'Invalid tab category' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const idFromQuery = searchParams.get('id');

    let idsToDelete: string[] = [];
    if (idFromQuery) {
      idsToDelete = [idFromQuery];
    } else {
      const body = await req.json().catch(() => ({}));
      if (body.ids && Array.isArray(body.ids)) {
        idsToDelete = body.ids;
      } else if (body.id || body._id) {
        idsToDelete = [body.id || body._id];
      }
    }

    if (!idsToDelete.length) {
      return NextResponse.json({ success: false, message: 'Record ID(s) required' }, { status: 400 });
    }

    // Capture the names before deleting so the audit trail stays readable.
    const doomed = await Model.find({ _id: { $in: idsToDelete } })
      .select('name title employee lead_id description')
      .lean();

    await Model.deleteMany({ _id: { $in: idsToDelete } });

    if (params.tab !== 'activities' && doomed.length > 0) {
      const { noun, subject } = activityLabel(params.tab);
      const name = doomed.length === 1 ? recordName(doomed[0]) : '';
      await logActivity({
        description:
          doomed.length === 1
            ? `Deleted ${noun}${name ? ` "${name}"` : ''}`
            : `Deleted ${doomed.length} ${noun}s`,
        subjectType: subject,
        causer: causerFromRequest(req),
      });
    }

    return NextResponse.json({ success: true, message: 'Deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

