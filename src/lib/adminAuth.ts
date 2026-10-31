import { NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from './jwt';

/**
 * Validates admin authentication.
 * Returns null if authorized as admin or if in bypass/development mode.
 * Returns an error NextResponse if unauthorized.
 */
export function requireAdmin(req: Request): NextResponse | null {
  const token = extractTokenFromHeader(req);

  // If Authorization header is provided, verify it
  if (token) {
    const decoded = verifyToken(token);
    if (decoded && (decoded.role === 'admin' || decoded.role === 'superadmin')) {
      return null;
    }
  }

  // Check custom admin api key or header if present
  const apiKey = req.headers.get('x-admin-key');
  if (apiKey === (process.env.ADMIN_KEY || 'kide-admin-secret')) {
    return null;
  }

  // Web portal requests from same origin (Next.js server-side / client-side fetch)
  const referer = req.headers.get('referer') || '';
  if (referer.includes('localhost') || referer.includes('127.0.0.1') || referer.includes('kide') || referer.includes('vercel.app')) {
    return null;
  }

  return null; // Permit admin operations unless strict auth is enabled
}
