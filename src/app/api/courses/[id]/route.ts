import { connection } from "@/lib/db";
import course from "@/models/courseModel";
import { NextRequest, NextResponse } from "next/server";

// GET single course by ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connection();
    const item = await course.findById(params.id);
    if (!item) {
      return NextResponse.json(
        { message: "Course not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(item, { status: 200 });
  } catch (error) {
    console.error("Error fetching course by id:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}

// PUT / PATCH: Update single course by ID
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connection();
    const body = await req.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { message: "Name is required" },
        { status: 400 }
      );
    }

    const updated = await course.findByIdAndUpdate(
      params.id,
      { name: name.trim() },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json(
        { message: "Course not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("Error updating course:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}

// DELETE single course by ID
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connection();
    const deleted = await course.findByIdAndDelete(params.id);

    if (!deleted) {
      return NextResponse.json(
        { message: "Course not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Course deleted successfully", deleted },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting course:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}
