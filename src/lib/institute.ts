import { Institute } from '@/models/institute';
import { toLaravelDate } from '@/lib/employeeAuth';

/**
 * ASM = "Area Sales Manager" designation, or an ASM-prefixed employee ID.
 */
export function isAsm(employee: any): boolean {
  const designation = String(employee?.designation || '').trim().toLowerCase();
  const employeeId = String(employee?.employee_id || '').trim().toLowerCase();

  return designation.includes('area sales manager') || employeeId.startsWith('asm');
}

/**
 * Nine digit numeric id so the mobile app has a stable int id (same idea as
 * the lead legacy ids).
 */
export async function nextInstituteLegacyId(): Promise<number> {
  for (let attempt = 0; attempt < 25; attempt++) {
    const id = Math.floor(100000000 + Math.random() * 900000000);
    const exists = await Institute.exists({ legacy_id: id });
    if (!exists) return id;
  }
  return Date.now();
}

export function serializeInstitute(doc: any) {
  return {
    id: doc._id ? doc._id.toString() : String(doc.id || ''),
    legacy_id: doc.legacy_id ?? null,
    institute_name: doc.institute_name || '',
    person_name: doc.person_name || '',
    position: doc.position || '',
    phone: doc.phone || '',
    email: doc.email || '',
    district: doc.district || '',
    place: doc.place || '',
    notes: doc.notes || '',
    created_by: doc.created_by || '',
    created_by_id: doc.created_by_id || '',
    created_at: toLaravelDate(doc.createdAt),
    updated_at: toLaravelDate(doc.updatedAt),
  };
}
