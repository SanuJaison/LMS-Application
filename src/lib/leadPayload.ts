/**
 * Normalize an incoming lead payload (app form, admin form or API client) into
 * the fields stored on the Lead document.
 *
 * Aliases are accepted so older clients keep working:
 *   contact_number | phone | contact   -> contact_number + phone
 *   whats_number | whatsapp_number     -> whats_number + whatsapp_number
 *   interested_course | course         -> interested_course + course
 *   lead_source | source               -> lead_source + source
 *   admission_status | status          -> admission_status + status
 *   remarks | notes                    -> remarks + notes
 */
export function normalizeLeadPayload(body: any) {
  const contact = body.contact_number || body.phone || body.contact || '';
  const whatsApp = body.whats_number || body.whatsapp_number || contact;

  const leadId = body.lead_id || `LD-${Math.floor(1000 + Math.random() * 9000)}`;

  const admissionStatus = body.admission_status || body.status || 'New';
  const isAdmitted =
    admissionStatus === 'Admitted' ||
    admissionStatus === 'Won' ||
    admissionStatus === 'admitted' ||
    body.status === 4 ||
    body.status === 'Won';

  let studentId = body.student_id || '';
  if (isAdmitted && !studentId) {
    studentId = `STU-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  const course = body.interested_course || body.course || '';
  const source = body.lead_source || body.source || 'Campus Drive / College Seminar';
  const notes = body.remarks || body.notes || '';

  return {
    lead_id: leadId,
    name: String(body.name || '').trim(),
    contact_number: String(contact).trim(),
    phone: String(contact).trim(),
    whats_number: String(whatsApp).trim(),
    whatsapp_number: String(whatsApp).trim(),
    district: body.district || 'Ernakulam',
    place: String(body.place || '').trim(),
    age: body.age ? Number(body.age) : undefined,
    qualification: String(body.qualification || '').trim(),
    college_name: String(body.college_name || '').trim(),
    current_year: String(body.current_year || '').trim(),
    interested_topic: String(body.interested_topic || '').trim(),
    interested_course: String(course).trim(),
    course: String(course).trim(),
    employee: String(body.employee || '').trim(),
    employee_id: String(body.employee_id || '').trim(),
    email: String(body.email || '').trim(),
    address: String(body.address || '').trim(),

    // Follow-up & Admission Tracking
    lead_source: source,
    source: source,
    student_interest: body.student_interest || 'Medium',
    next_followup_date: body.next_followup_date || '',
    remarks: String(notes).trim(),
    notes: String(notes).trim(),
    admission_status: admissionStatus,
    status: admissionStatus,
    presentation: body.presentation || 'Not Scheduled',
    student_id: studentId,
    proof_url: String(body.proof_url || '').trim(),
    followups: Array.isArray(body.followups) ? body.followups : [],
  };
}

/**
 * Validate the two fields every lead must have.
 * Returns an error message, or null when the payload is valid.
 */
export function validateLeadPayload(body: any): string | null {
  if (!body.name || !String(body.name).trim()) {
    return 'Validation failed: Student Name (name) is required.';
  }

  const contact = body.contact_number || body.phone || body.contact;
  if (!contact || !String(contact).trim()) {
    return 'Validation failed: Contact Number (phone) is required.';
  }

  return null;
}
