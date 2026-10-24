import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { TaskTemplate } from '@/models/taskTemplate';

// 1. GET: Fetch task templates from database
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const search = req.nextUrl.searchParams.get('search');
    const query = search
      ? {
          $or: [
            { title: { $regex: search, $options: 'i' } },
            { metric_type: { $regex: search, $options: 'i' } },
            { designation: { $regex: search, $options: 'i' } },
            { frequency: { $regex: search, $options: 'i' } },
          ],
        }
      : {};

    const templates = await TaskTemplate.find(query).sort({ createdAt: -1 });
    return NextResponse.json(templates, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching task templates:', error);
    return NextResponse.json({ message: error.message || 'Failed to fetch task templates' }, { status: 500 });
  }
}

// 2. POST: Create task template in database
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();

    const {
      title,
      metric_type = 'Leads Generated',
      designation,
      frequency = 'daily',
      target_count = 15,
      is_carry_over = true,
      is_active = true,
      description = '',
    } = body;

    if (!title || !designation) {
      return NextResponse.json(
        { message: 'Title and Designation are required' },
        { status: 400 }
      );
    }

    const newTemplate = await TaskTemplate.create({
      title: title.trim(),
      metric_type: metric_type.trim(),
      designation: designation.trim(),
      frequency,
      target_count: Number(target_count) || 15,
      is_carry_over: Boolean(is_carry_over),
      is_active: Boolean(is_active),
      description: description.trim(),
    });

    return NextResponse.json(newTemplate, { status: 201 });
  } catch (error: any) {
    console.error('Error creating task template:', error);
    return NextResponse.json({ message: error.message || 'Failed to create task template' }, { status: 500 });
  }
}

// 3. PUT: Update task template in database
export async function PUT(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const id = body.id || body._id;

    if (!id) {
      return NextResponse.json({ message: 'Template ID is required' }, { status: 400 });
    }

    const updated = await TaskTemplate.findByIdAndUpdate(
      id,
      {
        title: body.title?.trim(),
        metric_type: body.metric_type?.trim(),
        designation: body.designation?.trim(),
        frequency: body.frequency,
        target_count: Number(body.target_count),
        is_carry_over: Boolean(body.is_carry_over),
        is_active: Boolean(body.is_active),
        description: body.description?.trim(),
      },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ message: 'Task template not found' }, { status: 404 });
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    console.error('Error updating task template:', error);
    return NextResponse.json({ message: error.message || 'Failed to update task template' }, { status: 500 });
  }
}

// 4. DELETE: Delete task template from database
export async function DELETE(req: NextRequest) {
  try {
    await connectDB();
    const searchParams = req.nextUrl.searchParams;
    let id = searchParams.get('id');
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
      await TaskTemplate.deleteMany({ _id: { $in: ids } });
      return NextResponse.json({ message: 'Task templates deleted successfully' }, { status: 200 });
    }

    if (!id) {
      return NextResponse.json({ message: 'Template ID is required' }, { status: 400 });
    }

    const deleted = await TaskTemplate.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ message: 'Task template not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Task template deleted successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting task template:', error);
    return NextResponse.json({ message: error.message || 'Failed to delete task template' }, { status: 500 });
  }
}
