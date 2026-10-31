import mongoose, { Schema, Document } from 'mongoose';

export interface ITaskTemplate extends Document {
  title: string;
  description?: string;
  designation?: string;
  priority?: string;
  points?: number;
  is_active?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TaskTemplateSchema = new Schema<ITaskTemplate>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    designation: {
      type: String,
      default: 'Business Development Executive',
      trim: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    points: {
      type: Number,
      default: 10,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const TaskTemplate =
  mongoose.models.TaskTemplate ||
  mongoose.model<ITaskTemplate>('TaskTemplate', TaskTemplateSchema);

export default TaskTemplate;
