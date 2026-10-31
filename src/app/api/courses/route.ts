import { connection } from "@/lib/db";
import course from "@/models/courseModel";
import { NextRequest, NextResponse } from "next/server";

// 1. GET: Fetch all courses (with search filter)
export async function GET(req: NextRequest) {
  try {
    await connection();

    const search = req.nextUrl.searchParams.get("search");

    const query = search
      ? {
          $or: [{ name: { $regex: search, $options: "i" } }],
        }
      : {};

    const allCourses = await course.find(query).sort({ _id: 1 });

    return NextResponse.json(allCourses, { status: 200 });
  } catch (error) {
    console.error("Error fetching courses:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}

// 2. POST: Create new course
export async function POST(req: NextRequest) {
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

    const newCourse = await course.create({
      name: name.trim(),
    });

    return NextResponse.json(newCourse, { status: 201 });
  } catch (error) {
    console.error("Error creating course:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}

// 3. PUT: Update course (via body: { id / _id, name })
export async function PUT(req: NextRequest) {
  try {
    await connection();

    const body = await req.json();
    const id = body.id || body._id;
    const { name } = body;

    if (!id || !name) {
      return NextResponse.json(
        { message: "ID and name are required" },
        { status: 400 }
      );
    }

    const updated = await course.findByIdAndUpdate(
      id,
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

// 4. DELETE: Delete course (via query param ?id=... or body { id })
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
        { message: "Course ID is required" },
        { status: 400 }
      );
    }

    const deleted = await course.findByIdAndDelete(id);

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
