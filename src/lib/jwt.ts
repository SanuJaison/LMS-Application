import jwt from 'jsonwebtoken';

const KNOWN_SECRETS: string[] = Array.from(
  new Set(
    [
      process.env.JWT_SECRET,
      process.env.JWTSecretKey,
      process.env.JWT_SECRET_KEY,
      'kide-sales-crm-jwt-secret-key-2026',
      'secretkey123',
    ].filter(Boolean) as string[]
  )
);

const PRIMARY_JWT_SECRET = KNOWN_SECRETS[0] || 'kide-sales-crm-jwt-secret-key-2026';

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
 * Extracts Bearer token from header string, Request object, or Headers.
 * Also tolerates bare JWT tokens passed without the "Bearer " prefix.
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
      input.headers.get('token') ||
      '';
  } else if (typeof (input as any).get === 'function') {
    authHeader =
      (input as any).get('Authorization') ||
      (input as any).get('authorization') ||
      (input as any).get('token') ||
      '';
  }

  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (match) return match[1].trim();

  // Tolerate raw JWT without "Bearer " prefix
  const trimmed = authHeader.trim();
  if (trimmed.startsWith('eyJ')) {
    return trimmed;
  }

  return null;
}

/**
 * Verifies JWT token across all known secrets and returns decoded payload.
 */
export function verifyToken(token: string): DecodedToken | null {
  if (!token) return null;

  const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();

  for (const secret of KNOWN_SECRETS) {
    try {
      const decoded = jwt.verify(cleanToken, secret);
      return decoded as DecodedToken;
    } catch {
      // Try next known secret
    }
  }

  return null;
}

/**
 * Signs payload into JWT token string.
 */
export function signToken(payload: object, expiresIn: string | number = '30d'): string {
  return jwt.sign(payload, PRIMARY_JWT_SECRET, { expiresIn: expiresIn as any });
}
