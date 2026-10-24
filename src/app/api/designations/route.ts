import { connection } from "@/lib/db";
import designation from "@/models/designationModel";
import { NextRequest, NextResponse } from "next/server";

// 1. GET: Fetch all designations (with search filter)
export async function GET(req: NextRequest) {
  try {
    await connection();

    const search = req.nextUrl.searchParams.get("search");

    const query = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { prefix: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const allDesignations = await designation
      .find(query)
      .sort({ createdAt: -1 });

    return NextResponse.json(allDesignations, { status: 200 });
  } catch (error) {
    console.error("Error fetching designations:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}

// 2. POST: Create new designation
export async function POST(req: NextRequest) {
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

    const newDesignation = await designation.create({
      name: name.trim(),
      prefix: prefix.trim(),
    });

    return NextResponse.json(newDesignation, { status: 201 });
  } catch (error) {
    console.error("Error creating designation:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}

// 3. PUT: Update designation (via body: { id / _id, name, prefix })
export async function PUT(req: NextRequest) {
  try {
    await connection();

    const body = await req.json();
    const id = body.id || body._id;
    const { name, prefix } = body;

    if (!id || !name || !prefix) {
      return NextResponse.json(
        { message: "ID, name, and prefix are required" },
        { status: 400 }
      );
    }

    const updated = await designation.findByIdAndUpdate(
      id,
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
      // ignore if no JSON body
    }

    if (ids.length > 0) {
      await designation.deleteMany({ _id: { $in: ids } });
      return NextResponse.json(
        { message: "Designations deleted successfully" },
        { status: 200 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { message: "Designation ID is required" },
        { status: 400 }
      );
    }

    const deleted = await designation.findByIdAndDelete(id);

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

