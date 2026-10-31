import { connection } from "@/lib/db";
import district from "@/models/districtModel";
import { NextRequest, NextResponse } from "next/server";

// Default Kerala districts seeded automatically when the collection is empty
const DEFAULT_DISTRICTS = [
  { name: "Thiruvananthapuram", zone: "South Zone" },
  { name: "Kollam", zone: "South Zone" },
  { name: "Pathanamthitta", zone: "South Zone" },
  { name: "Alappuzha", zone: "South Zone" },
  { name: "Kottayam", zone: "South Zone" },
  { name: "Idukki", zone: "Central Zone" },
  { name: "Ernakulam", zone: "Central Zone" },
  { name: "Thrissur", zone: "Central Zone" },
  { name: "Palakkad", zone: "Central Zone" },
  { name: "Malappuram", zone: "Central Zone" },
  { name: "Wayanad", zone: "North Zone" },
  { name: "Kozhikode", zone: "North Zone" },
  { name: "Kannur", zone: "North Zone" },
  { name: "Kasaragod", zone: "North Zone" },
];

// 1. GET: Fetch all districts (with optional search filter)
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

    // Auto-seed defaults on first load
    if (!search && (await district.countDocuments()) === 0) {
      await district.insertMany(DEFAULT_DISTRICTS);
    }

    const allDistricts = await district.find(query).sort({ _id: 1 });

    return NextResponse.json(allDistricts, { status: 200 });
  } catch (error) {
    console.error("Error fetching districts:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}

// 2. POST: Create new district
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
  } catch (error) {
    console.error("Error creating district:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}

// 3. PUT: Update district (via body: { id / _id, name, zone, description })
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
  } catch (error) {
    console.error("Error updating district:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}

// 4. DELETE: Delete district (via query param ?id=... or body { id })
export async function DELETE(req: NextRequest) {
  try {
    await connection();

    const searchParams = req.nextUrl.searchParams;
    let id = searchParams.get("id");

    if (!id) {
      try {
        const body = await req.json();
        id = body?.id || body?._id;
      } catch {
        // ignore if no JSON body
      }
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
  } catch (error) {
    console.error("Error deleting district:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}
