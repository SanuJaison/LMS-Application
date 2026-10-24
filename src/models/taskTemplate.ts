import mongoose, { Schema, Document } from 'mongoose';

export interface ITaskTemplate extends Document {
  title: string;
  metric_type: string;
  designation: string;
  frequency: string;
  target_count: number;
  is_carry_over: boolean;
  is_active: boolean;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TaskTemplateSchema = new Schema<ITaskTemplate>(
  {
    title: { type: String, required: true, trim: true },
    metric_type: { type: String, required: true, default: 'Leads Generated', trim: true },
    designation: { type: String, required: true, trim: true },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'daily' },
    target_count: { type: Number, required: true, default: 15 },
    is_carry_over: { type: Boolean, default: true },
    is_active: { type: Boolean, default: true },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

export const TaskTemplate =
  mongoose.models.TaskTemplate || mongoose.model<ITaskTemplate>('TaskTemplate', TaskTemplateSchema);

export default TaskTemplate;
