import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/models/users';
import { Employee } from '@/models/employee';
import { signToken } from '@/lib/jwt';
import bcrypt from 'bcryptjs';

/**
 * Escape a string so it can be used safely inside a RegExp.
 */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Verify a plain-text password against a stored hash (bcrypt) or a legacy
 * plain-text value. Legacy plain-text passwords are upgraded to bcrypt on
 * the first successful login.
 */
async function checkPassword(password: string, doc: any): Promise<boolean> {
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
 * POST /api/login
 *
 * Supports two kinds of login:
 *   1. Employee  -> { "employee_id": "BDE005", "password": "test123" }
 *   2. Admin/User -> { "email": "admin@kide.com", "password": "password123" }
 *
 * Both return the same shape: { success, token, user }
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

        return NextResponse.json({
          success: true,
          message: 'Login successful. JWT token issued.',
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

    // Seed default admin if user doesn't exist and credentials match default admin
    if (!user) {
      const totalUsers = await User.countDocuments();
      if (totalUsers === 0 || cleanEmail.includes('admin')) {
        const hashedPassword = await bcrypt.hash(password, 10);
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

    return NextResponse.json({
      success: true,
      message: 'Login successful. JWT token issued.',
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
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
