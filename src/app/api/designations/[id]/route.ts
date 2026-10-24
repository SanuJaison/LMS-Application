import { connection } from "@/lib/db";
import designation from "@/models/designationModel";
import { NextRequest, NextResponse } from "next/server";

// GET single designation by ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connection();
    const item = await designation.findById(params.id);
    if (!item) {
      return NextResponse.json(
        { message: "Designation not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(item, { status: 200 });
  } catch (error) {
    console.error("Error fetching designation by id:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}

// PUT / PATCH: Update single designation by ID
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connection();
    const body = await req.json();
    const { name, prefix } = body;

    if (!name || !prefix) {
      return NextResponse.json(
        { message: "Name and prefix are required" },
        { status: 400 }
      );
    }

    const updated = await designation.findByIdAndUpdate(
      params.id,
      { name: name.trim(), prefix: prefix.trim() },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json(
        { message: "Designation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("Error updating designation:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}

// DELETE single designation by ID
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connection();
    const deleted = await designation.findByIdAndDelete(params.id);

    if (!deleted) {
      return NextResponse.json(
        { message: "Designation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Designation deleted successfully", deleted },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting designation:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}
