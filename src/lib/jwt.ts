import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'kide-sales-crm-jwt-secret-key-2026';

export interface DecodedToken {
  id?: string;
  employee_id?: string;
  name?: string;
  email?: string;
  role?: string;
  designation?: string;
  team?: string;
  zone?: string;
  district?: string;
  [key: string]: any;
}

/**
 * Extracts Bearer token from header string or Request object.
 */
export function extractTokenFromHeader(
  input: string | Request | Headers | null | undefined
): string | null {
  if (!input) return null;

  let authHeader = '';

  if (typeof input === 'string') {
    authHeader = input;
  } else if (input instanceof Request) {
    authHeader =
      input.headers.get('Authorization') ||
      input.headers.get('authorization') ||
      '';
  } else if (typeof (input as any).get === 'function') {
    authHeader =
      (input as any).get('Authorization') ||
      (input as any).get('authorization') ||
      '';
  }

  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Verifies JWT token and returns decoded payload.
 */
export function verifyToken(token: string): DecodedToken | null {
  try {
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded as DecodedToken;
  } catch {
    return null;
  }
}

/**
 * Signs payload into JWT token string.
 */
export function signToken(payload: object, expiresIn: string | number = '30d'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as any });
}
