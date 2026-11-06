import bcrypt from 'bcryptjs';

/**
 * Verify a plain-text password against a stored value (plain-text or legacy bcrypt hash).
 */
export async function checkPassword(password: string, doc: any): Promise<boolean> {
  if (!doc || !doc.password) return false;

  const stored = String(doc.password);

  // Legacy bcrypt hashes ($2a$, $2b$ from bcryptjs, $2y$ from PHP/Laravel)
  if (/^\$2[aby]\$/.test(stored)) {
    return bcrypt.compare(password, stored);
  }

  // Plain-text match (keep as plain text so Admin can view it)
  return stored === password;
}

/**
 * Return password as plain text for storage.
 */
export async function hashPassword(password: string): Promise<string> {
  return String(password).trim();
}
