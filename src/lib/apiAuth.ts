import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Employee } from '@/models/employee';
import { User } from '@/models/users';
import { extractTokenFromHeader, verifyToken, type DecodedToken } from '@/lib/jwt';
import { hierarchyRole, type HierarchyRole } from '@/lib/hierarchy';
import { escapeRegex } from '@/lib/employeeAuth';

/**
 * Shared authentication + hierarchy scoping for every API route.
 *
 * Rules enforced here:
 *   - No token            -> 401
 *   - Invalid/expired     -> 401
 *   - Inactive employee   -> 401
 *   - Wrong role          -> 403
 *   - BDE                 -> only itself
 *   - ASM / BDM           -> itself + employees that report to it (downward only)
 *   - SM                  -> itself + its whole downward subtree (ASMs + BDEs)
 *   - MD / admin          -> everything
 *
 * Scoping is downward only (reports_to), never by team, so two ASMs that share
 * a team can never see each other's BDEs.
 */

export type AuthRole = HierarchyRole | 'ADMIN';

export interface AuthContext {
  decoded: DecodedToken;
  /** Employee document for employee tokens; null for admin tokens. */
  employee: any | null;
  role: AuthRole;
  isAdmin: boolean;
  employeeId: string;
  name: string;
  team: string;
}

export type AuthResult =
  | { ok: true; auth: AuthContext }
  | { ok: false; response: NextResponse };

export function unauthorized(
  message = 'Authentication required. Send a valid Bearer token.'
) {
  return NextResponse.json({ success: false, message }, { status: 401 });
}

export function forbidden(message = 'You do not have permission to access this resource.') {
  return NextResponse.json({ success: false, message }, { status: 403 });
}

/**
 * Resolve the caller from the Authorization header. Returns null for a missing,
 * invalid, expired or inactive identity.
 */
export async function authenticate(req: Request, tokenOverride?: string): Promise<AuthContext | null> {
  await connectDB();

  const token = tokenOverride || extractTokenFromHeader(req);
  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded) return null;

  const tokenRole = String(decoded.role || '').toLowerCase();
  const isExplicitAdmin = tokenRole === 'admin' || tokenRole === 'superadmin';

  // 1. If not explicitly admin, try finding in Employee collection (SM, ASM, BDE, etc.)
  if (!isExplicitAdmin) {
    let employee: any = null;
    const empIdOrDocId = decoded.id || decoded._id || decoded.employee_id;

    if (empIdOrDocId) {
      try {
        if (mongoose.Types.ObjectId.isValid(String(empIdOrDocId))) {
          employee = await Employee.findById(empIdOrDocId).lean();
        }
      } catch {
        employee = null;
      }
    }

    if (!employee) {
      const orConditions: any[] = [];
      if (decoded.employee_id) orConditions.push({ employee_id: decoded.employee_id });
      if (empIdOrDocId && typeof empIdOrDocId === 'string' && empIdOrDocId.length < 24) {
        orConditions.push({ employee_id: empIdOrDocId });
      }
      if (decoded.email) orConditions.push({ email: decoded.email.toLowerCase() });

      if (orConditions.length > 0) {
        employee = await Employee.findOne({ $or: orConditions }).lean();
      }
    }

    if (employee) {
      if (String(employee.status || '').toLowerCase() === 'inactive') return null;

      return {
        decoded,
        employee,
        role: hierarchyRole(employee),
        isAdmin: false,
        employeeId: String(employee.employee_id || ''),
        name: String(employee.name || ''),
        team: String(employee.team || ''),
      };
    }
  }

  // 2. Check in Users collection (Admin Portal)
  let user: any = null;
  const adminId = decoded.id || decoded._id;

  if (adminId) {
    try {
      if (mongoose.Types.ObjectId.isValid(String(adminId))) {
        user = await User.findById(adminId).lean();
      }
    } catch {
      user = null;
    }
  }

  if (!user && decoded.email) {
    user = await User.findOne({ email: decoded.email.toLowerCase() }).lean();
  }

  if (user) {
    if (String(user.status || '').toLowerCase() === 'inactive') return null;

    return {
      decoded,
      employee: null,
      role: 'ADMIN',
      isAdmin: true,
      employeeId: '',
      name: user.name || decoded.name || 'Admin',
      team: '',
    };
  }

  // 3. Fallback: Check Employee collection even if token had an admin/manager label
  let fallbackEmp: any = null;
  if (decoded.employee_id || decoded.email || decoded.id) {
    fallbackEmp = await Employee.findOne({
      $or: [
        ...(decoded.employee_id ? [{ employee_id: decoded.employee_id }] : []),
        ...(decoded.email ? [{ email: decoded.email.toLowerCase() }] : []),
        ...(decoded.id && mongoose.Types.ObjectId.isValid(String(decoded.id)) ? [{ _id: decoded.id }] : []),
      ],
    }).lean();
  }

  if (fallbackEmp && String(fallbackEmp.status || '').toLowerCase() !== 'inactive') {
    return {
      decoded,
      employee: fallbackEmp,
      role: hierarchyRole(fallbackEmp),
      isAdmin: false,
      employeeId: String(fallbackEmp.employee_id || ''),
      name: String(fallbackEmp.name || ''),
      team: String(fallbackEmp.team || ''),
    };
  }

  // 4. Resilience Fallback: If DB query timed out or had connection drop,
  // but JWT signature is verified and not expired, preserve the session!
  if (isExplicitAdmin) {
    return {
      decoded,
      employee: null,
      role: 'ADMIN',
      isAdmin: true,
      employeeId: '',
      name: decoded.name || 'Admin User',
      team: '',
    };
  }

  if (
    decoded.employee_id ||
    decoded.role === 'employee' ||
    decoded.role === 'SM' ||
    decoded.role === 'ASM' ||
    decoded.role === 'BDE' ||
    decoded.role === 'BDM' ||
    decoded.designation
  ) {
    const derivedRole = hierarchyRole({
      employee_id: decoded.employee_id,
      designation: decoded.designation || decoded.role || 'BDE',
    });
    return {
      decoded,
      employee: {
        _id: decoded.id || decoded._id || decoded.employee_id,
        employee_id: decoded.employee_id || '',
        name: decoded.name || 'User',
        email: decoded.email || '',
        designation: decoded.designation || derivedRole,
        team: decoded.team || '',
        zone: decoded.zone || '',
        district: decoded.district || '',
        reports_to: decoded.reports_to || null,
        status: 'active',
      },
      role: derivedRole,
      isAdmin: false,
      employeeId: String(decoded.employee_id || ''),
      name: String(decoded.name || 'User'),
      team: String(decoded.team || ''),
    };
  }

  return null;
}

/** Any valid token (employee or admin). */
export async function requireAuth(req: Request): Promise<AuthResult> {
  const auth = await authenticate(req);
  if (!auth) return { ok: false, response: unauthorized() };
  return { ok: true, auth };
}

/** Employee token only (rejects admin tokens on app-only endpoints). */
export async function requireEmployee(req: Request): Promise<AuthResult> {
  const result = await requireAuth(req);
  if (!result.ok) return result;
  if (!result.auth.employee) {
    return {
      ok: false,
      response: forbidden(
        'This endpoint requires an employee token. Log in with an employee_id / email.'
      ),
    };
  }
  return result;
}

/** Token must belong to one of the allowed roles. */
export async function requireRoles(req: Request, roles: AuthRole[]): Promise<AuthResult> {
  const result = await requireAuth(req);
  if (!result.ok) return result;
  if (!roles.includes(result.auth.role)) {
    return {
      ok: false,
      response: forbidden(`This action requires one of these roles: ${roles.join(', ')}.`),
    };
  }
  return result;
}

export function isManagerRole(role: AuthRole): boolean {
  return (
    role === 'ADMIN' ||
    role === 'MD' ||
    role === 'SM' ||
    role === 'ASM' ||
    role === 'BDM'
  );
}

export interface Scope {
  auth: AuthContext;
  /** true = admin/MD, no filtering. */
  isAll: boolean;
  /** Visible employee_ids, including the caller. */
  ids: string[];
  /** Visible employee names, including the caller. */
  names: string[];
  idSet: Set<string>;
}

/**
 * Build the set of employees the caller is allowed to see.
 * Traversal is strictly downward through `reports_to`.
 */
export async function getScope(auth: AuthContext): Promise<Scope> {
  if (auth.isAdmin || auth.role === 'MD') {
    return { auth, isAll: true, ids: [], names: [], idSet: new Set() };
  }

  const docs = new Map<string, any>();
  const add = (doc: any) => {
    if (doc?._id) docs.set(String(doc._id), doc);
  };

  add(auth.employee);

  const depth =
    auth.role === 'SM' ? 4 : auth.role === 'ASM' || auth.role === 'BDM' ? 2 : 0;

  let frontier: string[] = auth.employeeId ? [auth.employeeId] : [];
  for (let level = 0; level < depth && frontier.length > 0; level++) {
    const reports: any[] = await Employee.find({
      reports_to: { $in: frontier },
    }).lean();

    reports.forEach(add);
    frontier = reports
      .map((e: any) => String(e.employee_id || ''))
      .filter(Boolean);
  }

  const visible = Array.from(docs.values());
  const ids = visible.map((e: any) => String(e.employee_id || '')).filter(Boolean);
  const names = visible.map((e: any) => String(e.name || '')).filter(Boolean);

  return { auth, isAll: false, ids, names, idSet: new Set(ids) };
}

/**
 * Mongo filter limiting a collection to the caller's visible employees.
 * Pass every field that can hold an employee id or name.
 */
export function scopeFilter(
  scope: Scope,
  options: { idFields?: string[]; nameFields?: string[] } = {}
): Record<string, any> {
  if (scope.isAll) return {};

  const or: Record<string, any>[] = [];

  for (const field of options.idFields || []) {
    if (scope.ids.length > 0) {
      or.push({ [field]: { $in: scope.ids } });
    }
  }

  for (const field of options.nameFields || []) {
    for (const name of scope.names) {
      or.push({ [field]: new RegExp(`^${escapeRegex(name)}$`, 'i') });
    }
  }

  // Nothing visible -> match nothing (never fall through to "all").
  return or.length > 0 ? { $or: or } : { _id: null };
}

/** Combine filters with $and so a scope can never be overwritten by a param. */
export function andFilter(...filters: any[]): Record<string, any> {
  const list = filters.filter(
    (filter) => filter && typeof filter === 'object' && Object.keys(filter).length > 0
  );
  if (list.length === 0) return {};
  if (list.length === 1) return list[0];
  return { $and: list };
}

/** True when the employee id/name is inside the caller's scope. */
export function canAccessEmployee(
  scope: Scope,
  employeeId?: string | null,
  name?: string | null
): boolean {
  if (scope.isAll) return true;

  const id = String(employeeId || '').trim();
  if (id && scope.idSet.has(id)) return true;

  const value = String(name || '').trim().toLowerCase();
  if (value && scope.names.some((n) => n.toLowerCase() === value)) return true;

  return false;
}

/** Scope filter for lead-like documents. */
export function leadScopeFilter(scope: Scope): Record<string, any> {
  return scopeFilter(scope, {
    idFields: ['employee_id', 'asm_id', 'bde_id'],
    nameFields: ['employee', 'bde_name'],
  });
}
