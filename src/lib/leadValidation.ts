/**
 * Student IDs are compared case-insensitively with surrounding whitespace
 * removed, so "stu-1001" and " STU-1001 " are treated as the same ID.
 */
export function normalizeStudentId(value: any): string {
  return String(value ?? '').trim().toUpperCase();
}

export function sameStudentId(a: any, b: any): boolean {
  const left = normalizeStudentId(a);
  const right = normalizeStudentId(b);
  return left === right;
}

/**
 * A lead's Student ID is assigned once (during follow-up or at admission) and
 * must never change afterwards. Returns an error message when the incoming ID
 * conflicts with the one already stored on the lead.
 */
export function studentIdMismatchError(existing: any, incoming: any): string | null {
  const current = normalizeStudentId(existing);
  const next = normalizeStudentId(incoming);

  if (!current || !next || current === next) return null;

  return (
    `Student ID mismatch: this lead already has ${String(existing).trim()}, ` +
    `but ${String(incoming).trim()} was sent. The Student ID used in follow-up ` +
    `and at closing must be the same.`
  );
}
