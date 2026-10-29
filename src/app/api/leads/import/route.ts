import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAdmin } from '@/lib/adminAuth';
import { causerFromRequest, logActivity } from '@/lib/activityLog';
import { Lead } from '@/models/lead';
import { Employee } from '@/models/employee';
import { assignLegacyIds } from '@/lib/mobileLead';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/leads/import
 *
 * Bulk import leads from a CSV file.
 *
 * Accepts any of:
 *   - application/json  { "csv": "Name,Phone,...\n..." }
 *   - application/json  { "rows": [{ "Name": "...", ... }] }
 *   - multipart/form-data with a `file` field (CSV)
 *
 * The header row is matched by name, so column order does not matter and
 * extra columns are ignored. The "Assigned Employee" column accepts either
 * an employee ID (BDE001) or a full employee name; it is resolved against
 * the employees collection and stored on the lead as both `employee`
 * (name) and `employee_id`.
 */

const FIELD_ALIASES: Record<string, string[]> = {
  name: ['name', 'fullname', 'studentname', 'leadname', 'customername', 'student'],
  // `whatsapp` is matched before `phone` so a dedicated WhatsApp column is not
  // swallowed by the phone column. `phone` falls back to it when missing.
  whatsapp: ['whatsappnumber', 'whatsapp', 'whatsnumber', 'watsapp', 'watsappnumber'],
  phone: ['phone', 'phonenumber', 'contact', 'contactnumber', 'mobile', 'mobilenumber'],
  email: ['email', 'emailaddress', 'mail', 'emailid'],
  // `place` is matched before `address` for the same reason.
  place: ['place', 'area', 'locality'],
  address: ['address', 'location', 'fulladdress'],
  district: ['district', 'districtname'],
  source: ['source', 'leadsource', 'sourceoflead'],
  assigned: ['assigned', 'assignedto', 'assignedemployee', 'employee', 'employeeid', 'bde', 'staff', 'counselor'],
  course: ['course', 'interestedcourse', 'coursename'],
  interested_topic: ['interestedtopic', 'topic'],
  notes: ['notes', 'remarks', 'remark', 'comment', 'comments'],
  status: ['status', 'leadstatus', 'admissionstatus'],
  qualification: ['qualification'],
  college: ['college', 'collegename', 'institute', 'institutename'],
  current_year: ['currentyear', 'yearofstudy', 'studyyear', 'academicyear'],
  age: ['age'],
  student_interest: ['studentinterest', 'interestlevel', 'interest'],
  next_followup_date: ['nextfollowupdate', 'followupdate', 'nextfollowup'],
};

function normalizeKey(value: string): string {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * RFC4180-ish CSV parser: handles quoted fields, escaped quotes (""),
 * embedded commas/newlines, CRLF and a UTF-8 BOM.
 */
function parseCSV(input: string, delimiter = ','): string[][] {
  const text = String(input || '').replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char === '\r') {
      // ignore, handled by \n
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => String(cell).trim() !== ''));
}

/**
 * Decide whether the file is comma or semicolon separated by looking at the
 * header line. Excel in some locales exports semicolons.
 */
function detectDelimiter(text: string): string {
  const firstLine = String(text || '').split(/\r?\n/)[0] || '';
  const commas = (firstLine.match(/,/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  return semicolons > commas ? ';' : ',';
}

/**
 * Map header cells to logical fields. Exact matches win over partial ones so
 * "Assigned Employee" is not mistaken for the "Name" column.
 */
function mapHeaders(headers: string[]): Record<string, number> {
  const normalized = headers.map(normalizeKey);
  const mapping: Record<string, number> = {};
  const used = new Set<number>();

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    let bestIndex = -1;
    let bestScore = 0;

    normalized.forEach((header, index) => {
      if (!header || used.has(index)) return;

      for (const alias of aliases) {
        const key = normalizeKey(alias);
        let score = 0;

        if (header === key) score = 3;
        else if (header.startsWith(key)) score = 2;
        else if (header.includes(key)) score = 1;

        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      }
    });

    if (bestIndex >= 0) {
      mapping[field] = bestIndex;
      used.add(bestIndex);
    }
  }

  return mapping;
}

function cell(row: string[], mapping: Record<string, number>, field: string): string {
  const index = mapping[field];
  if (index === undefined) return '';
  return String(row[index] ?? '').trim();
}

async function readCsvFromRequest(req: Request): Promise<{ csv: string; rows: any[] } | null> {
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    if (file && typeof file !== 'string') {
      return { csv: await (file as File).text(), rows: [] };
    }
    const csv = form.get('csv');
    if (typeof csv === 'string') return { csv, rows: [] };
    return null;
  }

  const body = await req.json().catch(() => null);
  if (!body) return null;

  if (Array.isArray(body.rows)) return { csv: '', rows: body.rows };
  if (typeof body.csv === 'string') return { csv: body.csv, rows: [] };
  if (typeof body.data === 'string') return { csv: body.data, rows: [] };

  return null;
}

export async function POST(req: Request) {
  try {
    const denied = requireAdmin(req);
    if (denied) return denied;

    await connectDB();

    const input = await readCsvFromRequest(req);

    if (!input) {
      return NextResponse.json(
        {
          success: false,
          message: 'No CSV data received. Send { csv } as JSON or a CSV file in the "file" field.',
        },
        { status: 400 }
      );
    }

    // Normalise both input styles into a list of plain objects keyed by header
    let records: Record<string, string>[] = [];

    if (input.rows.length > 0) {
      records = input.rows.map((row) => {
        const flat: Record<string, string> = {};
        Object.entries(row || {}).forEach(([key, value]) => {
          flat[key] = String(value ?? '').trim();
        });
        return flat;
      });
    } else {
      const delimiter = detectDelimiter(input.csv);
      const table = parseCSV(input.csv, delimiter);

      if (table.length < 2) {
        return NextResponse.json(
          { success: false, message: 'The CSV needs a header row and at least one data row.' },
          { status: 400 }
        );
      }

      const headers = table[0].map((h) => String(h).trim());
      const mapping = mapHeaders(headers);

      if (mapping.name === undefined) {
        return NextResponse.json(
          {
            success: false,
            message: `Could not find a "Name" column. Detected columns: ${headers.join(', ')}`,
          },
          { status: 400 }
        );
      }

      records = table.slice(1).map((row) => {
        const obj: Record<string, string> = {};
        Object.entries(mapping).forEach(([field, index]) => {
          obj[field] = String(row[index] ?? '').trim();
        });
        return obj;
      });
    }

    if (records.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No lead rows found in the file.' },
        { status: 400 }
      );
    }

    if (records.length > 5000) {
      return NextResponse.json(
        { success: false, message: 'Please import at most 5000 leads at a time.' },
        { status: 413 }
      );
    }

    // Resolve assigned employees by ID or name
    const employees: any[] = await Employee.find().lean();
    const byId = new Map<string, any>();
    const byName = new Map<string, any>();

    employees.forEach((emp) => {
      if (emp.employee_id) byId.set(String(emp.employee_id).trim().toLowerCase(), emp);
      if (emp.name) byName.set(String(emp.name).trim().toLowerCase(), emp);
    });

    // Avoid generating duplicate lead ids, including existing ones
    const existing = await Lead.find({}, { lead_id: 1 }).lean();
    const usedLeadIds = new Set<string>(
      (existing as any[]).map((doc) => String(doc.lead_id || '')).filter(Boolean)
    );

    const nextLeadId = () => {
      let id = '';
      do {
        id = `LD-${Math.floor(1000 + Math.random() * 9000)}`;
      } while (usedLeadIds.has(id));
      usedLeadIds.add(id);
      return id;
    };

    const docs: any[] = [];
    const errors: { row: number; message: string }[] = [];
    const unmatchedAssignments = new Set<string>();
    let assignedCount = 0;

    records.forEach((record, index) => {
      const rowNumber = index + 2; // +1 header, +1 for 1-based
      const name = (record.name || '').trim();
      const phone = (record.phone || '').trim() || (record.whatsapp || '').trim();
      const whatsapp = (record.whatsapp || '').trim() || phone;
      const address = (record.address || '').trim() || (record.place || '').trim();
      const place = (record.place || '').trim() || address;

      if (!name) {
        errors.push({ row: rowNumber, message: 'Missing student name' });
        return;
      }

      const assignedRaw = (record.assigned || '').trim();
      let employeeName = '';
      let employeeId = '';

      if (assignedRaw) {
        const key = assignedRaw.toLowerCase();
        const match = byId.get(key) || byName.get(key);

        if (match) {
          employeeName = match.name || '';
          employeeId = match.employee_id || '';
          assignedCount++;
        } else {
          // Keep the raw value so the admin can still see/fix it later
          employeeName = assignedRaw;
          unmatchedAssignments.add(assignedRaw);
        }
      }

      const status = (record.status || 'New').trim() || 'New';
      const source = (record.source || 'Cold Call').trim() || 'Cold Call';

      docs.push({
        lead_id: nextLeadId(),
        name,
        contact_number: phone,
        phone,
        whats_number: whatsapp,
        whatsapp_number: whatsapp,
        email: (record.email || '').trim(),
        address,
        place,
        district: (record.district || 'Ernakulam').trim() || 'Ernakulam',
        interested_topic: (record.interested_topic || '').trim(),
        interested_course: (record.course || '').trim(),
        course: (record.course || '').trim(),
        qualification: (record.qualification || '').trim(),
        college_name: (record.college || '').trim(),
        current_year: (record.current_year || '').trim(),
        age: (record.age || '').trim(),
        employee: employeeName,
        employee_id: employeeId,
        lead_source: source,
        source,
        student_interest: (record.student_interest || 'Medium').trim() || 'Medium',
        next_followup_date: (record.next_followup_date || '').trim(),
        remarks: (record.notes || '').trim(),
        notes: (record.notes || '').trim(),
        admission_status: status,
        status,
        presentation: 'Not Scheduled',
        student_id: '',
        proof_url: '',
        followups: [],
      });
    });

    if (docs.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'No valid leads found. Every row needs at least a student name.',
          data: { imported: 0, failed: errors.length, total: records.length, errors },
        },
        { status: 400 }
      );
    }

    await assignLegacyIds(docs);

    const inserted = await Lead.insertMany(docs, { ordered: false });

    await logActivity({
      description: `Imported ${inserted.length} lead${inserted.length === 1 ? '' : 's'} from CSV`,
      subjectType: 'Lead',
      causer: causerFromRequest(req),
    });

    return NextResponse.json({
      success: true,
      message: `${inserted.length} lead${inserted.length === 1 ? '' : 's'} imported successfully`,
      data: {
        import_id: Date.now(),
        total_rows: records.length,
        imported: inserted.length,
        failed: errors.length,
        total: records.length,
        assigned: assignedCount,
        unmatched_assignments: Array.from(unmatchedAssignments),
        errors,
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
