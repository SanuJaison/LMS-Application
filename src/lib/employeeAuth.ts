import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Employee } from '@/models/employee';
import { extractTokenFromHeader, verifyToken } from '@/lib/jwt';

/**
 * Standard success envelope used by the mobile app (Laravel-style).
 */
export function ok(data: any, message = 'OK', status = 200) {
  return NextResponse.json({ success: true, message, data }, { status });
}

/**
 * Standard error envelope used by the mobile app.
 */
export function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

/**
 * Resolve the employee behind a Bearer token.
 * Returns null when the token is missing, invalid, or not an employee token.
 */
export async function getEmployee(req: Request): Promise<any | null> {
  await connectDB();
  const token = extractTokenFromHeader(req);
  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded || decoded.role !== 'employee') return null;

  try {
    return await Employee.findById(decoded.id);
  } catch {
    return null;
  }
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Case-insensitive exact-match filter for records that store the employee as a name.
 */
export function nameRegex(name?: string) {
  const value = (name || '').trim();
  if (!value) return null;
  return { $regex: `^${escapeRegex(value)}$`, $options: 'i' };
}

export function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

export function formatTime(date: Date = new Date()): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

/**
 * Laravel-style timestamp: 2026-08-05T05:39:17.000000Z
 */
export function toLaravelDate(value?: Date | string | null): string | null {
  if (!value) return null;
  const date = new Date(value as any);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().replace(/\.(\d{3})Z$/, '.$1000Z');
}

/**
 * Mongo ObjectIds are strings; the mobile app expects a numeric id.
 */
export function numericId(id: any): number | null {
  if (!id) return null;
  const parsed = parseInt(String(id).slice(-6), 16);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Public shape of an employee, matching the login response.
 */
export function serializeEmployee(employee: any) {
  if (!employee) return null;
  return {
    id: numericId(employee._id),
    name: employee.name || '',
    email: employee.email || '',
    email_verified_at: null,
    created_at: toLaravelDate(employee.createdAt),
    updated_at: toLaravelDate(employee.updatedAt),
    employee_id: employee.employee_id || '',
    designation_name: employee.designation || null,
    designation_id: null,
    team: employee.team || '',
    zone: employee.zone || '',
    district: employee.district || '',
    reports_to: employee.reports_to || null,
    roles: [],
    permissions: [],
  };
}

/**
 * Parse "09:30 AM" / "18:45" into minutes since midnight.
 */
export function parseTimeToMinutes(value?: string | null): number | null {
  if (!value) return null;
  const match = String(value)
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const suffix = (match[3] || '').toUpperCase();

  if (suffix === 'PM' && hours < 12) hours += 12;
  if (suffix === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
}
