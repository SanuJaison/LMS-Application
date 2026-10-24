import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'kide_kerala_crm_super_secret_jwt_key_2026';

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
  name?: string;
}

/**
 * Sign JWT Token for authenticated Admin
 */
export function signToken(payload: TokenPayload, expiresIn: string = '7d'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as any });
}

/**
 * Verify and decode JWT Token
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Extract Bearer token from Request or Authorization header string
 */
export function extractTokenFromHeader(reqOrHeader: Request | string | null): string | null {
  if (!reqOrHeader) return null;
  let headerValue: string | null = null;
  if (typeof reqOrHeader === 'string') {
    headerValue = reqOrHeader;
  } else if (reqOrHeader && typeof (reqOrHeader as any).headers?.get === 'function') {
    headerValue = reqOrHeader.headers.get('Authorization') || reqOrHeader.headers.get('authorization');
  }
  if (headerValue && headerValue.startsWith('Bearer ')) {
    return headerValue.substring(7).trim();
  }
  return null;
}

/**
 * Middleware helper to authenticate admin requests
 */
export function authenticateAdmin(req: Request): {
  authenticated: boolean;
  user?: TokenPayload;
  error?: string;
  status: number;
} {
  const token = extractTokenFromHeader(req);
  if (!token) {
    return {
      authenticated: false,
      error: 'Authorization token missing. Please provide Bearer token in Authorization header.',
      status: 401,
    };
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return {
      authenticated: false,
      error: 'Invalid or expired authorization token.',
      status: 401,
    };
  }

  if (decoded.role !== 'admin' && decoded.role !== 'manager') {
    return {
      authenticated: false,
      error: 'Forbidden: Admin authorization required.',
      status: 403,
    };
  }

  return {
    authenticated: true,
    user: decoded,
    status: 200,
  };
}
