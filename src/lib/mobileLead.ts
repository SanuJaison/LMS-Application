import mongoose from 'mongoose';
import { Course, District } from '@/models';
import { Employee } from '@/models/employee';
import { Lead } from '@/models/lead';
import { escapeRegex, numericId, toLaravelDate } from '@/lib/employeeAuth';

/**
 * Helpers that convert our internal lead documents into the shape expected by
 * the Flutter `LeadModel` (lead_model.dart).
 *
 * The app expects:
 *   id (int), name, phone, email, address,
 *   district_id (int), course_id (int),
 *   source (int), status (int),
 *   notes, created_at, updated_at,
 *   district { id, name } | null, course { id, name } | null,
 *   followups [{ id, lead_id, employee_id, followup_date, type, notes }]
 */

// 1 = New, 2 = Follow Up, 3 = Presentation Scheduled, 4 = Admitted, 5 = Closed
export function leadStatusToInt(value: any): number {
  const status = String(value ?? '').trim().toLowerCase();

  switch (status) {
    case 'admitted':
    case 'won':
    case 'admission':
    case 'enrolled':
      return 4;
    case 'lost':
    case 'closed':
    case 'not interested':
    case 'rejected':
      return 5;
    case 'presentation scheduled':
    case 'presentation':
    case 'scheduled':
    case 'payment pending':
    case 'payment pending verification':
      return 3;
    case 'follow up':
    case 'followup':
    case 'follow uped':
    case 'followuped':
    case 'follow-up':
    case 'followed up':
    case 'contacted':
    case 'interested':
    case 'pending':
    case 'in progress':
      return 2;
    case 'new':
    case 'new lead':
    case '':
      return 1;
    default:
      return 1;
  }
}

export function leadStatusValuesFromInt(value: number): string[] {
  switch (value) {
    case 4:
      return ['Admitted', 'Won', 'Admission', 'Enrolled'];
    case 5:
      return ['Lost', 'Closed', 'Not Interested', 'Rejected'];
    case 3:
      return [
        'Presentation Scheduled',
        'Presentation',
        'Scheduled',
        'Payment Pending',
        'Payment Pending Verification',
      ];
    case 2:
      return [
        'Follow Up',
        'Followup',
        'Follow Uped',
        'Followuped',
        'Follow-up',
        'Followed Up',
        'Contacted',
        'Interested',
        'Pending',
        'In Progress',
      ];
    default:
      return ['New', 'New Lead'];
  }
}

// The app stores `source` as an int, so map our source labels onto stable ids.
const SOURCE_IDS: Record<string, number> = {
  'cold call': 1,
  website: 2,
  'website form': 2,
  'campus drive': 3,
  'campus drive / college seminar': 3,
  'college visit': 3,
  seminar: 3,
  referral: 4,
  'social media': 5,
  'instagram ad': 6,
  'facebook ad': 7,
  'whatsapp enquiry': 8,
  'walk-in': 9,
  'google ads': 10,
  other: 11,
};

export function leadSourceToInt(value: any): number {
  const source = String(value ?? '').trim().toLowerCase();
  return SOURCE_IDS[source] ?? 1;
}

/**
 * Nine digit numeric id that the mobile app uses for /leads/{id}/close and
 * /leads/{id}/follow-up.
 */
export function randomLegacyId(): number {
  return Math.floor(100000000 + Math.random() * 900000000);
}

export async function generateUniqueLegacyId(): Promise<number> {
  for (let attempt = 0; attempt < 25; attempt++) {
    const id = randomLegacyId();
    const exists = await Lead.exists({ legacy_id: id });
    if (!exists) return id;
  }
  return Date.now();
}

/**
 * Find a lead by MongoDB id, numeric legacy id, or human readable lead_id.
 */
export async function findLeadByAnyId(id: string): Promise<any | null> {
  const value = String(id || '').trim();
  if (!value) return null;

  if (/^[0-9a-fA-F]{24}$/.test(value)) {
    const byObjectId = await Lead.findById(value);
    if (byObjectId) return byObjectId;
  }

  if (/^\d+$/.test(value)) {
    const byLegacy = await Lead.findOne({ legacy_id: Number(value) });
    if (byLegacy) return byLegacy;
  }

  const byLeadId = await Lead.findOne({ lead_id: value });
  if (byLeadId) return byLeadId;

  return null;
}

/**
 * Resolve the "Assigned Employee" value into both the employee name and the
 * employee ID. Accepts either a name (BDE001's owner) or an ID (BDE001).
 * Used by manual lead creation, editing, CSV import and the mobile app.
 */
export async function resolveEmployeeAssignment(input: {
  employee?: any;
  employee_id?: any;
}): Promise<{ employee: string; employee_id: string }> {
  const rawId = String(input.employee_id ?? '').trim();
  const rawName = String(input.employee ?? '').trim();

  const rx = (value: string) => new RegExp(`^${escapeRegex(value)}$`, 'i');

  let emp: any = null;

  if (rawId) {
    emp = await Employee.findOne({ employee_id: rx(rawId) }).lean();
  }

  if (!emp && rawName) {
    emp = await Employee.findOne({
      $or: [{ name: rx(rawName) }, { employee_id: rx(rawName) }],
    }).lean();
  }

  if (emp) {
    return {
      employee: emp.name || rawName,
      employee_id: emp.employee_id || rawId,
    };
  }

  return { employee: rawName, employee_id: rawId };
}

function normalizeName(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Match a free-text district/course name against the catalog. Falls back to
 * word matching so "Fullstack Development" still matches
 * "Full-Stack Web Development".
 */
function findCatalogMatch(map: Map<string, any>, value: string): any | null {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const exact = map.get(raw.toLowerCase());
  if (exact) return exact;

  const normalized = normalizeName(raw);
  if (!normalized) return null;

  for (const [key, doc] of Array.from(map.entries())) {
    if (normalizeName(key) === normalized) return doc;
  }

  const words = raw
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);

  if (words.length > 0) {
    for (const [key, doc] of Array.from(map.entries())) {
      const normalizedKey = normalizeName(key);
      if (words.every((word) => normalizedKey.includes(word))) return doc;
    }
  }

  return null;
}

export async function serializeLeadsForMobile(docs: any[]): Promise<any[]> {
  const [districts, courses, employees] = await Promise.all([
    District.find().lean(),
    Course.find().lean(),
    Employee.find({}, { name: 1, employee_id: 1 }).lean(),
  ]);

  const districtMap = new Map<string, any>();
  (districts as any[]).forEach((d) => {
    if (d.name) districtMap.set(String(d.name).trim().toLowerCase(), d);
  });

  const courseMap = new Map<string, any>();
  (courses as any[]).forEach((c) => {
    if (c.name) courseMap.set(String(c.name).trim().toLowerCase(), c);
  });

  const employeeMap = new Map<string, number>();
  (employees as any[]).forEach((e) => {
    if (e.name) employeeMap.set(String(e.name).trim().toLowerCase(), numericId(e._id) ?? 0);
  });

  return docs.map((doc) => {
    const leadNumericId = doc.legacy_id ?? numericId(doc._id) ?? 0;

    const districtName = String(doc.district || '').trim();
    const courseName = String(doc.interested_course || doc.course || '').trim();

    const districtDoc = findCatalogMatch(districtMap, districtName);
    const courseDoc = findCatalogMatch(courseMap, courseName);

    return {
      id: leadNumericId,
      name: doc.name || '',
      phone: doc.phone || doc.contact_number || '',
      email: doc.email || '',
      address: doc.address || doc.place || '',
      place: doc.place || '',
      whatsapp_number:
        doc.whats_number || doc.whatsapp_number || doc.phone || doc.contact_number || '',
      age: doc.age ?? '',
      qualification: doc.qualification || '',
      college_name: doc.college_name || '',
      current_year: doc.current_year || '',
      interested_topic: doc.interested_topic || '',
      interested_course: doc.interested_course || doc.course || '',
      lead_source: doc.lead_source || doc.source || '',
      employee: doc.employee || '',
      employee_id: doc.employee_id || '',
      district_id: districtDoc ? numericId(districtDoc._id) ?? 0 : 0,
      course_id: courseDoc ? numericId(courseDoc._id) ?? 0 : 0,
      source: leadSourceToInt(doc.lead_source || doc.source),
      status: leadStatusToInt(doc.admission_status || doc.status),
      notes: doc.notes || doc.remarks || '',
      student_interest: doc.student_interest || '',
      next_followup_date: doc.next_followup_date || '',
      presentation: doc.presentation || '',
      student_id: doc.student_id || '',
      payment_verification: doc.payment_verification || 'Pending',
      payment_amount: doc.payment_amount ?? 0,
      admission_status: doc.admission_status || doc.status || 'New',
      created_at: toLaravelDate(doc.createdAt),
      updated_at: toLaravelDate(doc.updatedAt),
      // Always expose the name the admin typed, even when it is not in the catalog
      district: districtDoc
        ? { id: numericId(districtDoc._id) ?? 0, name: districtDoc.name }
        : districtName
          ? { id: 0, name: districtName }
          : null,
      course: courseDoc
        ? { id: numericId(courseDoc._id) ?? 0, name: courseDoc.name }
        : courseName
          ? { id: 0, name: courseName }
          : null,
      followups: Array.isArray(doc.followups)
        ? doc.followups.map((f: any) => ({
            id: numericId(f._id) ?? 0,
            lead_id: leadNumericId,
            employee_id:
              employeeMap.get(String(f.recorded_by || '').trim().toLowerCase()) ?? 0,
            followup_date: f.date || '',
            type: f.admission_status || null,
            notes: f.remarks || null,
            student_interest: f.student_interest || '',
            lead_source: f.lead_source || '',
            next_followup_date: f.next_followup_date || '',
            payment_verification: f.payment_verification || '',
            student_id: f.student_id || '',
            course: f.course || '',
          }))
        : [],
    };
  });
}

/**
 * Generate numeric legacy ids for a batch of documents without colliding with
 * each other or with ids already stored.
 */
export async function assignLegacyIds(docs: any[]): Promise<void> {
  if (docs.length === 0) return;

  const existing = await Lead.find(
    { legacy_id: { $exists: true, $ne: null } },
    { legacy_id: 1 }
  ).lean();

  const used = new Set<number>((existing as any[]).map((d) => Number(d.legacy_id)));

  for (const doc of docs) {
    let id = randomLegacyId();
    while (used.has(id)) id = randomLegacyId();
    used.add(id);
    doc.legacy_id = id;
  }
}

export function isValidObjectId(value: string): boolean {
  return mongoose.isValidObjectId(value);
}
