import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/models/users';
import { Employee } from '@/models/employee';
import { Designation } from '@/models';
import { signToken } from '@/lib/jwt';
import { checkPassword, hashPassword } from '@/lib/password';
import { logActivity } from '@/lib/activityLog';

/**
 * Escape a string so it can be used safely inside a RegExp.
 */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Mongo ObjectIds are strings, but the mobile app expects a numeric id
 * (Laravel-style). Derive a stable number from the ObjectId.
 */
function numericId(id: any): number | null {
  if (!id) return null;
  const hex = String(id);
  const parsed = parseInt(hex.slice(-6), 16);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Format a date the way Laravel serialises timestamps: 2026-08-05T05:39:17.000000Z
 */
function toLaravelDate(value?: Date | string | null): string | null {
  if (!value) return null;
  const date = new Date(value as any);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().replace(/\.(\d{3})Z$/, '.$1000Z');
}

interface LaravelUserShape {
  id: number | null;
  name: string;
  email: string;
  email_verified_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  designation_name: string | null;
  designation_id: number | null;
  roles: string[];
  permissions: string[];
}

/**
 * Build the `data.user` object the Flutter app expects.
 */
async function buildLaravelUser(doc: any, designationName?: string): Promise<LaravelUserShape> {
  const name = designationName || doc.designation || '';

  let designationDoc: any = null;
  if (name) {
    designationDoc = await Designation.findOne({
      name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' },
    }).lean();
  }

  return {
    id: numericId(doc._id),
    name: doc.name || '',
    email: doc.email || '',
    email_verified_at: null,
    created_at: toLaravelDate(doc.createdAt),
    updated_at: toLaravelDate(doc.updatedAt),
    designation_name: name || null,
    designation_id: designationDoc?._id ? numericId(designationDoc._id) : null,
    roles: [],
    permissions: [],
  };
}

/**
 * POST /api/login
 *
 * Supports two kinds of login:
 *   1. Employee   -> { "employee_id": "BDE005", "password": "test123" }
 *   2. Admin/User -> { "email": "admin@kide.com", "password": "password123" }
 *
 * Responds with the Laravel-compatible shape the mobile app expects:
 *   { success, message, data: { token, user, require_password_change } }
 *
 * The top-level `token` and `user` keys are kept for the existing admin web UI.
 */
export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json().catch(() => ({}));

    const password = typeof body.password === 'string' ? body.password : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';

    // Accept a few common key names for the employee ID
    const rawEmployeeId = body.employee_id ?? body.emp_id ?? body.employeeId ?? body.username ?? '';
    const explicitEmployeeId = String(rawEmployeeId || '').trim();

    // If the client sends the employee ID in the email field (no "@" means it is not an email)
    let employeeId = explicitEmployeeId;
    if (!employeeId && email && !email.includes('@')) {
      employeeId = email;
    }

    if (!password || (!email && !employeeId)) {
      return NextResponse.json(
        { success: false, message: 'Employee ID (or email) and password are required' },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------------------
    // 1. Employee login with a custom Employee ID (e.g. BDE005, ASM001)
    // ---------------------------------------------------------------------
    if (employeeId) {
      const employee: any = await Employee.findOne({
        employee_id: { $regex: `^${escapeRegex(employeeId)}$`, $options: 'i' },
      }).select('+password');

      if (employee) {
        if (String(employee.status || '').toLowerCase() === 'inactive') {
          return NextResponse.json(
            {
              success: false,
              message: 'This employee account is inactive. Please contact your admin.',
            },
            { status: 403 }
          );
        }

        if (!employee.password) {
          return NextResponse.json(
            {
              success: false,
              message: 'No password has been set for this employee. Please contact your admin.',
            },
            { status: 401 }
          );
        }

        const isEmployeeMatch = await checkPassword(password, employee);
        if (!isEmployeeMatch) {
          return NextResponse.json(
            { success: false, message: 'Invalid employee ID or password' },
            { status: 401 }
          );
        }

        const token = signToken({
          id: employee._id.toString(),
          name: employee.name,
          email: employee.email || '',
          role: 'employee',
        });

        const requirePasswordChange = Boolean(employee.require_password_change);
        const laravelUser = await buildLaravelUser(employee, employee.designation);

        return NextResponse.json({
          success: true,
          message: 'Logged in successfully',
          // --- kept for the existing admin web UI ---
          token,
          user: {
            id: employee._id.toString(),
            name: employee.name,
            email: employee.email || '',
            employee_id: employee.employee_id,
            designation: employee.designation || '',
            team: employee.team || '',
            zone: employee.zone || '',
            district: employee.district || '',
            role: 'employee',
            status: employee.status,
          },
          // --- Laravel-compatible shape for the mobile app ---
          data: {
            token,
            user: laravelUser,
            require_password_change: requirePasswordChange,
          },
        });
      }

      // An explicit employee ID was supplied but does not exist -> stop here.
      // (When the value came from the email box, fall through to the user lookup
      //  so identifiers like "admin" keep working.)
      if (explicitEmployeeId) {
        return NextResponse.json(
          { success: false, message: 'Invalid employee ID or password' },
          { status: 401 }
        );
      }
    }

    // ---------------------------------------------------------------------
    // 2. Admin / User login with email (existing behaviour)
    // ---------------------------------------------------------------------
    if (!email) {
      return NextResponse.json(
        { success: false, message: 'Email and password are required' },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    // Look for user in database
    let user = await User.findOne({ email: cleanEmail });

    // Bootstrap the very first admin account only. Previously any unknown
    // email containing "admin" was auto-created as an admin, which let anyone
    // mint an admin account. Now this only runs on an empty users collection.
    if (!user) {
      const totalUsers = await User.countDocuments();
      if (totalUsers === 0) {
        const hashedPassword = await hashPassword(password);
        user = await User.create({
          name: 'Admin User',
          email: cleanEmail,
          password: hashedPassword,
          role: 'admin',
          status: 'active',
        });
      }
    }

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password with bcryptjs
    const isMatch = await checkPassword(password, user);

    if (!isMatch) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Generate JWT token with 7-day expiration
    const token = signToken({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    });

    const laravelUser = await buildLaravelUser(user);

    await logActivity({
      description: 'Signed in to the admin panel',
      subjectType: 'Auth',
      causer: user.name || user.email,
    });

    return NextResponse.json({
      success: true,
      message: 'Logged in successfully',
      // --- kept for the existing admin web UI ---
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
      // --- Laravel-compatible shape for the mobile app ---
      data: {
        token,
        user: laravelUser,
        require_password_change: false,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Login failed' },
      { status: 500 }
    );
  }
}
