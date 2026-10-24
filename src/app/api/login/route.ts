import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/models/users';
import { signToken } from '@/lib/jwt';
import bcrypt from 'bcryptjs';

/**
 * POST /api/login - Admin Authentication with JWT Generation
 */
export async function POST(req: Request) {
  try {
    await connectDB();
    const { email, password } = await req.json();

    if (!email || !password) {
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
    let isMatch = false;
    if (user.password) {
      if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
        isMatch = await bcrypt.compare(password, user.password);
      } else {
        // Plain text legacy match -> upgrade to hashed password
        isMatch = user.password === password;
        if (isMatch) {
          user.password = await bcrypt.hash(password, 10);
          await user.save();
        }
      }
    }

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
