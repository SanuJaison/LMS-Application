export function normalizeLeadPayload(body: any): Record<string, any> {
  const data = { ...body };

  // Synchronize contact fields
  const contact =
    data.contact ||
    data.contact_number ||
    data.phone ||
    data.mobile ||
    '';
  if (!data.phone) data.phone = contact;
  if (!data.contact_number) data.contact_number = contact;

  const whatsapp =
    data.whats_number ||
    data.whatsapp_number ||
    data.whatsapp ||
    contact;
  data.whats_number = whatsapp;
  data.whatsapp_number = whatsapp;

  // Synchronize course fields
  const course =
    data.interested_course ||
    data.course ||
    data.course_name ||
    'Flutter';
  data.interested_course = course;
  data.course = course;

  // Synchronize source fields
  const source =
    data.lead_source ||
    data.source ||
    'Campus Drive / College Seminar';
  data.lead_source = source;
  data.source = source;

  // Synchronize admission status
  const admissionStatus =
    data.admission_status ||
    (typeof data.status === 'string' ? data.status : 'New');
  data.admission_status = admissionStatus;

  // Synchronize remarks & notes
  const notes = data.remarks || data.notes || '';
  data.remarks = notes;
  data.notes = notes;

  return data;
}

export function validateLeadPayload(body: any): string | null {
  if (!body) return 'Lead data is required';
  const name = body.name || body.student_name;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return 'Validation failed: Name is required.';
  }
  return null;
}
