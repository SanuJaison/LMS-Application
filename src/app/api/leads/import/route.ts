import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Lead } from '@/models/lead';
import { Employee } from '@/models/employee';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';
import { getNextStudentId } from '@/lib/studentId';
import { assignLegacyIds, resolveEmployeeAssignment } from '@/lib/mobileLead';

/**
 * POST /api/leads/import
 * Bulk CSV lead upload endpoint
 */
export async function POST(req: Request) {
  try {
    await connectDB();

    const token = extractTokenFromHeader(req);
    const decoded = token ? verifyToken(token) : null;
    let defaultEmployee = '';
    let defaultEmployeeId = '';

    if (decoded?.role === 'employee' && decoded.id) {
      const me: any = await Employee.findById(decoded.id).lean();
      if (me) {
        defaultEmployee = me.name;
        defaultEmployeeId = me.employee_id;
      }
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'No CSV file uploaded' },
        { status: 400 }
      );
    }

    const text = await file.text();
    const lines = text
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
        employee: defaultEmployee || 'Unassigned',
        employee_id: defaultEmployeeId || '',
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
