import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Employee } from '@/models/employee';
import { requireRoles } from '@/lib/apiAuth';
import { getAsmTeamAndDistricts } from '@/lib/hierarchy';
import { escapeRegex } from '@/lib/employeeAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/asm/districts
 * Returns ONLY the 2 assigned districts under the signed-in ASM's team
 * (e.g. ["Ernakulam", "Thrissur"] for EKM Team) for selecting when creating a BDE.
 */
export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await requireRoles(req, ['ASM', 'BDM', 'SM', 'ADMIN', 'MD']);
    if (!guard.ok) return guard.response;

    const { auth } = guard;
    const { searchParams } = new URL(req.url);
    const requestedAsm = (
      searchParams.get('asm_id') ||
      searchParams.get('employee_id') ||
      ''
    ).trim();

    let asmEmployee: any = null;
    if (auth.role === 'ASM' || auth.role === 'BDM') {
      asmEmployee = auth.employee;
    } else if (requestedAsm) {
      asmEmployee = await Employee.findOne({
        employee_id: new RegExp(`^${escapeRegex(requestedAsm)}$`, 'i'),
      }).lean();
    }

    if (!asmEmployee) {
      return NextResponse.json(
        {
          success: false,
          message: 'ASM not found. Pass your ASM Bearer token or ?asm_id=ASM001.',
        },
        { status: 400 }
      );
    }

    const { teamName, zone, districts, isOffice } =
      await getAsmTeamAndDistricts(asmEmployee);

    return NextResponse.json({
      success: true,
      team: teamName,
      zone,
      is_office: isOffice,
      count: districts.length,
      districts,
      data: districts.map((name, index) => ({
        id: index + 1,
        name,
        district: name,
        team: teamName,
        zone,
      })),
    });
  } catch (error: any) {
    console.error('GET /api/asm/districts error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to fetch ASM districts',
      },
      { status: 500 }
    );
  }
}
