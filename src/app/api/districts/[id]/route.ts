import { connection } from "@/lib/db";
import district from "@/models/districtModel";
import { NextRequest, NextResponse } from "next/server";

// GET single district by ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connection();
    const item = await district.findById(params.id);
    if (!item) {
      return NextResponse.json(
        { message: "District not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(item, { status: 200 });
  } catch (error) {
    console.error("Error fetching district by id:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}

// PUT / PATCH: Update single district by ID
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const updated = await district.findByIdAndUpdate(
      params.id,
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

// DELETE single district by ID
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connection();
    const deleted = await district.findByIdAndDelete(params.id);

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
