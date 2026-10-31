import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/models/users';
import { Employee } from '@/models/employee';
import { signToken } from '@/lib/jwt';
import { hierarchyRole } from '@/lib/hierarchy';
import bcrypt from 'bcryptjs';

/**
 * POST /api/login - Unified Authentication Endpoint
 * Supports:
 * 1. Admin login via email & password
 * 2. Employee login via employee_id or email & password
 * Returns JWT token and standardized user session.
 */
export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json().catch(() => ({}));
    const identifier = String(body.employee_id || body.email || '').trim();
    const password = String(body.password || '').trim();

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, message: 'Employee ID / Email and password are required' },
        { status: 400 }
      );
    }

    // 1. Check in Employees Collection first (Mobile app & Field Force)
    const employee: any = await Employee.findOne({
      $or: [
        { employee_id: new RegExp(`^${identifier}$`, 'i') },
        { email: identifier.toLowerCase() },
      ],
    }).lean();

    if (employee) {
      // If employee has a hashed password, verify it
      let passwordMatches = false;
      if (employee.password) {
        if (employee.password.startsWith('$2')) {
          passwordMatches = bcrypt.compareSync(password, employee.password);
        } else {
          passwordMatches = employee.password === password;
        }
      } else {
        // Fallback for default seed accounts
        passwordMatches = password === 'kide1234' || password === 'password123';
      }

      if (passwordMatches) {
        const role = hierarchyRole(employee);
        const token = signToken({
          id: employee._id.toString(),
          employee_id: employee.employee_id,
          name: employee.name,
          email: employee.email,
          role: 'employee',
          designation: employee.designation,
          team: employee.team,
          zone: employee.zone,
          district: employee.district,
          reports_to: employee.reports_to,
        });

        const userPayload = {
          id: employee._id.toString(),
          employee_id: employee.employee_id,
          name: employee.name,
          email: employee.email,
          role,
          designation: employee.designation || role,
          designation_name: employee.designation || role,
          team: employee.team || '',
          zone: employee.zone || '',
          district: employee.district || '',
          reports_to: employee.reports_to || null,
          status: employee.status || 'active',
          require_password_change: false,
        };

        return NextResponse.json({
          success: true,
          message: 'Login successful',
          token,
          user: userPayload,
          data: {
            token,
            user: userPayload,
          },
        });
      }
    }

    // 2. Check in Users Collection (Admin Portal)
    let adminUser = await User.findOne({ email: identifier.toLowerCase() });

    // Seed default admin if user collection is completely empty
    if (!adminUser) {
      const totalUsers = await User.countDocuments();
      if (totalUsers === 0 && identifier.toLowerCase().includes('admin')) {
        const hashedPassword = bcrypt.hashSync(password, 10);
        adminUser = await User.create({
          name: 'Admin User',
          email: identifier.toLowerCase(),
          password: hashedPassword,
          role: 'admin',
          status: 'active',
        });
      }
    }

    if (adminUser) {
      let adminPassMatches = false;
      if (adminUser.password) {
        if (adminUser.password.startsWith('$2')) {
          adminPassMatches = bcrypt.compareSync(password, adminUser.password);
        } else {
          adminPassMatches = adminUser.password === password;
        }
      }

      if (adminPassMatches) {
        const token = signToken({
          id: adminUser._id.toString(),
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role || 'admin',
        });

        const adminPayload = {
          id: adminUser._id.toString(),
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role || 'admin',
          designation: 'Administrator',
          team: '',
          zone: '',
          district: '',
          reports_to: null,
          status: adminUser.status || 'active',
          require_password_change: false,
        };

        return NextResponse.json({
          success: true,
          message: 'Login successful',
          token,
          user: adminPayload,
          data: {
            token,
            user: adminPayload,
          },
        });
      }
    }

    return NextResponse.json(
      { success: false, message: 'Invalid credentials. Please verify your Employee ID / Email and password.' },
      { status: 401 }
    );
  } catch (error: any) {
    console.error('POST /api/login error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Login failed' },
      { status: 500 }
    );
  }
}
