import bcrypt from 'bcryptjs';

/**
 * Verify a plain-text password against a stored hash (bcrypt) or a legacy
 * plain-text value. Legacy plain-text passwords are upgraded to bcrypt on
 * the first successful login.
 */
export async function checkPassword(password: string, doc: any): Promise<boolean> {
  if (!doc || !doc.password) return false;

  const stored = String(doc.password);

  // bcrypt hashes ($2a$, $2b$ from bcryptjs, $2y$ from PHP/Laravel)
  if (/^\$2[aby]\$/.test(stored)) {
    return bcrypt.compare(password, stored);
  }

  // Legacy plain-text match -> upgrade to a hash
  if (stored === password) {
    doc.password = await bcrypt.hash(password, 10);
    await doc.save();
    return true;
  }

  return false;
}

/**
 * Hash a plain-text password with bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
