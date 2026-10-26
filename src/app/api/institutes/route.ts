import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Institute } from '@/models/institute';
import { Employee } from '@/models/employee';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';
import { escapeRegex } from '@/lib/employeeAuth';
import { isAsm, nextInstituteLegacyId, serializeInstitute } from '@/lib/institute';

export const dynamic = 'force-dynamic';

/**
 * POST /api/institutes
 *
 * ASM (Area Sales Manager) adds an institute they visited.
 *
 * Body:
 *   institute_name  "XYZ College of Arts & Science"
 *   person_name     "Dr. Rajesh Kumar"
 *   position        "Principal"                 (optional, recommended)
 *   phone           "9847123456"                (contact_number / mobile also accepted)
 *   email           "principal@xyz.edu"         (optional)
 *   district        "Ernakulam"                 (optional)
 *   place           "Kakkanad"                  (optional)
 *   notes           "Interested in BCA batch"   (optional)
 *
 * The ASM is taken from the Bearer token, so the app never sends created_by.
 */
export async function POST(req: Request) {
  try {
    await connectDB();

    const employee = await getEmployeeFromRequest(req);
    if (!employee) {
      return NextResponse.json(
        { success: false, message: 'Unauthenticated. Please log in again.' },
        { status: 401 }
      );
    }

    if (!isAsm(employee)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Only Area Sales Managers (ASM) can add institutes.',
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON request body. Please provide institute details.' },
        { status: 400 }
      );
    }

    const instituteName = String(
      body.institute_name || body.instituteName || body.institute || ''
    ).trim();
    const personName = String(
      body.person_name || body.personName || body.contact_person || body.person || ''
    ).trim();
    const position = String(body.position || body.designation || body.role || '').trim();
    const phone = String(
      body.phone || body.contact_number || body.mobile || body.contact || ''
    ).trim();

    if (!instituteName) {
      return NextResponse.json(
        { success: false, message: 'Validation failed: institute_name (Institute Name) is required.' },
        { status: 400 }
      );
    }

    if (!personName) {
      return NextResponse.json(
        {
          success: false,
          message: 'Validation failed: person_name (Institute Person Name) is required.',
        },
        { status: 400 }
      );
    }

    if (!phone) {
      return NextResponse.json(
        { success: false, message: 'Validation failed: phone (Contact Number) is required.' },
        { status: 400 }
      );
    }

    const institute = await Institute.create({
      institute_name: instituteName,
      person_name: personName,
      position,
      phone,
      email: String(body.email || '').trim(),
      district: String(body.district || '').trim(),
      place: String(body.place || '').trim(),
      notes: String(body.notes || body.remarks || '').trim(),
      legacy_id: await nextInstituteLegacyId(),
      created_by: employee.name || '',
      created_by_id: employee.employee_id || '',
    });

    return NextResponse.json(
      {
        success: true,
        message: `Institute ${institute.institute_name} added successfully`,
        data: serializeInstitute(institute.toObject()),
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('POST /api/institutes error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to add institute' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/institutes
 *
 * - ASM / employee token: only the institutes they added.
 * - Admin / manager token: every institute (used by the admin panel).
 *
 * Optional query: ?search=text
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get('search') || '').trim();

    const token = extractTokenFromHeader(req);
    const decoded = token ? verifyToken(token) : null;

    const filter: Record<string, any> = {};

    if (!decoded) {
      // Read endpoints stay 200 so the app's auth interceptor is not triggered
      // by a stale token on a normal screen refresh.
      return NextResponse.json({ success: true, count: 0, data: [] });
    }

    if (decoded.role === 'employee') {
      const me: any = decoded.id ? await Employee.findById(decoded.id).lean() : null;
      if (!me) {
        return NextResponse.json({ success: true, count: 0, data: [] });
      }
      filter.$or = [
        { created_by_id: me.employee_id || '__none__' },
        { created_by: me.name || '__none__' },
      ];
    } else if (decoded.role !== 'admin' && decoded.role !== 'manager') {
      return NextResponse.json(
        { success: false, message: 'You are not allowed to view institutes.' },
        { status: 403 }
      );
    }

    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      const searchConditions = [
        { institute_name: rx },
        { person_name: rx },
        { position: rx },
        { phone: rx },
        { district: rx },
        { place: rx },
        { created_by: rx },
        { created_by_id: rx },
      ];
      filter.$and = [{ $or: searchConditions }];
    }

    const docs = await Institute.find(filter).sort({ createdAt: -1 }).lean();

    return NextResponse.json({
      success: true,
      count: docs.length,
      data: docs.map(serializeInstitute),
    });
  } catch (error: any) {
    console.error('GET /api/institutes error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to load institutes' },
      { status: 500 }
    );
  }
}

async function getEmployeeFromRequest(req: Request): Promise<any | null> {
  const token = extractTokenFromHeader(req);
  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded || decoded.role !== 'employee') return null;

  try {
    return await Employee.findById(decoded.id);
  } catch {
    return null;
  }
}
