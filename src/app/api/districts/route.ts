import { connection } from "@/lib/db";
import district from "@/models/districtModel";
import { NextRequest, NextResponse } from "next/server";

// 1. GET: Fetch all districts from database
export async function GET(req: NextRequest) {
  try {
    await connection();
    const search = req.nextUrl.searchParams.get("search");

    const query = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { zone: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const allDistricts = await district.find(query).sort({ _id: 1 });
    return NextResponse.json(allDistricts, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching districts:", error);
    return NextResponse.json(
      { message: error.message || "Failed to fetch districts" },
      { status: 500 }
    );
  }
}

// 2. POST: Create new district in database
export async function POST(req: NextRequest) {
  try {
    await connection();
    const body = await req.json();
    const { name, zone, description } = body;

    if (!name || !zone) {
      return NextResponse.json(
        { message: "Name and zone are required" },
        { status: 400 }
      );
    }

    const newDistrict = await district.create({
      name: name.trim(),
      zone: typeof zone === "string" ? zone.trim() : zone,
      description: (description || "").toString().trim(),
    });

    return NextResponse.json(newDistrict, { status: 201 });
  } catch (error: any) {
    console.error("Error creating district:", error);
    return NextResponse.json(
      { message: error.message || "Failed to create district" },
      { status: 500 }
    );
  }
}

// 3. PUT: Update district in database
export async function PUT(req: NextRequest) {
  try {
    await connection();
    const body = await req.json();
    const id = body.id || body._id;
    const { name, zone, description } = body;

    if (!id || !name || !zone) {
      return NextResponse.json(
        { message: "ID, name, and zone are required" },
        { status: 400 }
      );
    }

    const updated = await district.findByIdAndUpdate(
      id,
      {
        name: name.trim(),
        zone: typeof zone === "string" ? zone.trim() : zone,
        description: (description || "").toString().trim(),
      },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json(
        { message: "District not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    console.error("Error updating district:", error);
    return NextResponse.json(
      { message: error.message || "Failed to update district" },
      { status: 500 }
    );
  }
}

// 4. DELETE: Delete district from database
export async function DELETE(req: NextRequest) {
  try {
    await connection();
    const searchParams = req.nextUrl.searchParams;
    let id = searchParams.get("id");
    let ids: string[] = [];

    try {
      const body = await req.json();
      if (body) {
        id = id || body.id || body._id;
        if (Array.isArray(body.ids)) {
          ids = body.ids;
        }
      }
    } catch {
      // ignore
    }

    if (ids.length > 0) {
      await district.deleteMany({ _id: { $in: ids } });
      return NextResponse.json(
        { message: "Districts deleted successfully" },
        { status: 200 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { message: "District ID is required" },
        { status: 400 }
      );
    }

    const deleted = await district.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json(
        { message: "District not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "District deleted successfully", deleted },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error deleting district:", error);
    return NextResponse.json(
      { message: error.message || "Failed to delete district" },
      { status: 500 }
    );
  }
}
