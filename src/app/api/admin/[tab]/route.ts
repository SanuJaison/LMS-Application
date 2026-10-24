import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
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
    if (!data.district) data.district = 'Ernakulam';
    if (!data.zone) data.zone = 'Central Zone';
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

// 1. GET: Fetch all records for a tab
export async function GET(req: Request, { params }: { params: { tab: string } }) {
  try {
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
    const data = docs.map((doc: any) => ({ ...doc, id: doc._id.toString() }));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// 2. POST: Create a new record
export async function POST(req: Request, { params }: { params: { tab: string } }) {
  try {
    await connectDB();
    const Model = models[params.tab];

    if (!Model) {
      return NextResponse.json({ success: false, message: 'Invalid tab category' }, { status: 400 });
    }

    const body = await req.json();
    const payload = cleanData(params.tab, body);

    const created = await Model.create(payload);

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
    const updated = await Model.findByIdAndUpdate(id, payload, { new: true });

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Record not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// 4. DELETE: Delete record(s) by ID
export async function DELETE(req: Request, { params }: { params: { tab: string } }) {
  try {
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

    await Model.deleteMany({ _id: { $in: idsToDelete } });
    return NextResponse.json({ success: true, message: 'Deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

