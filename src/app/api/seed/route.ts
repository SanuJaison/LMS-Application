import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import {
  User,
  Zone,
  District,
  Employee,
  Lead,
  Attendance,
  Course,
  Team,
  Task,
  Wallet,
} from '@/models';
import {
  mockZones,
  mockDistricts,
  mockEmployees,
  mockLeads,
  mockLiveAttendance,
  mockCourses,
  mockTeams,
  mockTasks,
  mockWallets,
} from '@/data/mockData';

/**
 * GET /api/seed
 * Seed MongoDB with starter data for Kerala LMS & CRM
 */
export async function GET() {
  try {
    await connectDB();

    // 1. Admin User
    const existingUser = await User.findOne({ email: 'admin@kide.com' });
    if (!existingUser) {
      await User.create({
        name: 'Admin User',
        email: 'admin@kide.com',
        password: 'password123',
        role: 'admin',
        status: 'active',
      });
    }

    // 2. Zones
    const zoneCount = await Zone.countDocuments();
    if (zoneCount === 0) {
      await Zone.insertMany(mockZones.map((z) => ({ name: z.name, description: z.description })));
    }

    // 3. Districts
    const districtCount = await District.countDocuments();
    if (districtCount === 0) {
      await District.insertMany(mockDistricts.map((d) => ({ name: d.name, zone: d.zoneName })));
    }

    // 4. Employees
    const empCount = await Employee.countDocuments();
    if (empCount === 0) {
      await Employee.insertMany(
        mockEmployees.map((e) => ({
          employee_id: e.employee_id,
          name: e.name,
          email: e.email,
          contact_number: e.contact_number,
          designation: e.designation,
          district: e.district,
          zone: e.zone,
          upi_id: e.upi_id,
          status: e.status,
        }))
      );
    }

    // 5. Leads
    const leadCount = await Lead.countDocuments();
    if (leadCount === 0) {
      await Lead.insertMany(
        mockLeads.map((l) => ({
          name: l.name,
          phone: l.phone,
          email: l.email,
          course: l.course,
          district: l.district,
          employee: l.employee,
          status: l.status,
          source: l.source,
          notes: l.notes,
        }))
      );
    }

    // 6. Attendance
    const attCount = await Attendance.countDocuments();
    if (attCount === 0) {
      await Attendance.insertMany(
        mockLiveAttendance.map((a) => ({
          name: a.name,
          designation: a.designation,
          district: a.district,
          date: a.date,
          check_in: a.check_in,
          check_out: a.check_out || '06:00 PM',
          hours_worked: a.hours_worked || 8,
          status: a.status,
        }))
      );
    }

    // 7. Courses
    const courseCount = await Course.countDocuments();
    if (courseCount === 0) {
      await Course.insertMany(
        mockCourses.map((c) => ({
          name: c.name,
          fee: c.fee,
          duration: c.duration,
          status: c.status,
        }))
      );
    }

    // 8. Teams
    const teamCount = await Team.countDocuments();
    if (teamCount === 0) {
      await Team.insertMany(
        mockTeams.map((t) => ({
          name: t.name,
          zone: t.zone,
          team_lead: t.team_lead,
          description: t.description,
          members_count: t.members_count,
        }))
      );
    }

    // 9. Tasks
    const taskCount = await Task.countDocuments();
    if (taskCount === 0) {
      await Task.insertMany(
        mockTasks.map((t) => ({
          title: t.title,
          description: t.description,
          assigned_to: t.assigned_to,
          priority: t.priority,
          status: t.status,
          due_date: t.due_date,
        }))
      );
    }

    // 10. Wallets
    const walletCount = await Wallet.countDocuments();
    if (walletCount === 0) {
      await Wallet.insertMany(
        mockWallets.map((w) => ({
          employee: w.employee,
          balance: w.balance,
          currency: w.currency,
        }))
      );
    }

    return NextResponse.json({
      success: true,
      message: 'MongoDB collections successfully seeded with Kerala LMS starter data!',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Seeding failed' },
      { status: 500 }
    );
  }
}
