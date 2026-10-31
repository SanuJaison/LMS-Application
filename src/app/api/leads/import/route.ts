import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Lead } from '@/models/lead';
import { getNextStudentId } from '@/lib/studentId';
import { assignLegacyIds, resolveEmployeeAssignment } from '@/lib/mobileLead';
import { canAccessEmployee, forbidden, getScope, requireAuth } from '@/lib/apiAuth';

/**
 * POST /api/leads/import
 * Bulk CSV lead upload endpoint.
 *
 * Accepts multipart/form-data with a `file` field, or a JSON body `{ csv }`.
 * Employees always import leads assigned to themselves; managers may pass
 * `employee` / `employee_id`, which must be inside their hierarchy.
 */
export async function POST(req: Request) {
  try {
    await connectDB();

    const guard = await requireAuth(req);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const scope = await getScope(auth);

    const contentType = req.headers.get('content-type') || '';
    let csvText = '';
    let requestedEmployee = '';
    let requestedEmployeeId = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (file) csvText = await file.text();
      requestedEmployee = String(formData.get('employee') || '').trim();
      requestedEmployeeId = String(formData.get('employee_id') || '').trim();
    } else {
      const body = await req.json().catch(() => ({}));
      csvText = String(body.csv || body.data || '');
      requestedEmployee = String(body.employee || '').trim();
      requestedEmployeeId = String(body.employee_id || '').trim();
    }

    if (!csvText.trim()) {
      return NextResponse.json(
        { success: false, message: 'No CSV file uploaded' },
        { status: 400 }
      );
    }

    let defaultEmployee = '';
    let defaultEmployeeId = '';

    if (auth.employee) {
      defaultEmployee = auth.name;
      defaultEmployeeId = auth.employeeId;
    } else {
      if (!requestedEmployee && !requestedEmployeeId) {
        return NextResponse.json(
          {
            success: false,
            message: 'Validation failed: employee or employee_id is required for bulk import.',
          },
          { status: 400 }
        );
      }
      if (!auth.isAdmin && !canAccessEmployee(scope, requestedEmployeeId, requestedEmployee)) {
        return forbidden('You cannot import leads for an employee outside your hierarchy.');
      }
      const assignment = await resolveEmployeeAssignment({
        employee: requestedEmployee,
        employee_id: requestedEmployeeId,
      });
      defaultEmployee = assignment.employee || requestedEmployee;
      defaultEmployeeId = assignment.employee_id || requestedEmployeeId;
    }

    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length <= 1) {
      return NextResponse.json(
        { success: false, message: 'Uploaded file contains no lead rows' },
        { status: 400 }
      );
    }

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const nameIdx = header.findIndex((h) => h.includes('name'));
    const phoneIdx = header.findIndex(
      (h) => h.includes('phone') || h.includes('contact') || h.includes('mobile')
    );
    const districtIdx = header.findIndex((h) => h.includes('district'));
    const courseIdx = header.findIndex((h) => h.includes('course'));

    const importedLeads: any[] = [];
    let startStudentSeq = await getNextStudentId();
    let seqNum = parseInt(startStudentSeq.replace(/\D/g, ''), 10) || 1;

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      const name = nameIdx !== -1 ? parts[nameIdx] : parts[0];
      const phone = phoneIdx !== -1 ? parts[phoneIdx] : parts[1] || '';
      const district = districtIdx !== -1 ? parts[districtIdx] : parts[2] || 'Ernakulam';
      const course = courseIdx !== -1 ? parts[courseIdx] : parts[3] || 'Flutter';

      if (!name) continue;

      const studentId = `STU-${String(seqNum++).padStart(3, '0')}`;
      const leadId = `LD-${Math.floor(1000 + Math.random() * 9000)}`;

      importedLeads.push({
        lead_id: leadId,
        student_id: studentId,
        name,
        phone,
        contact_number: phone,
        district,
        course,
        interested_course: course,
        employee: defaultEmployee,
        employee_id: defaultEmployeeId,
        status: 1,
        admission_status: 'New',
        source: 'Bulk Import',
        lead_source: 'Bulk Import',
      });
    }

    await assignLegacyIds(importedLeads);
    const result = await Lead.insertMany(importedLeads);

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${result.length} leads`,
      data: {
        total_imported: result.length,
        imported_count: result.length,
        skipped_count: lines.length - 1 - result.length,
      },
    });
  } catch (error: any) {
    console.error('POST /api/leads/import error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to import leads' },
      { status: 500 }
    );
  }
}
