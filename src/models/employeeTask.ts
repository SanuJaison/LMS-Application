import mongoose, { Schema, Document } from 'mongoose';

export interface IEmployeeTask extends Document {
  employee: string;
  employee_id?: string;
  task_template: string;
  period_start: string;
  period_end: string;
  total_target: number;
  achieved: number;
  is_completed: boolean;
  metric_type?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeTaskSchema = new Schema<IEmployeeTask>(
  {
    employee: { type: String, required: true, trim: true },
    employee_id: { type: String, default: '', trim: true },
    task_template: { type: String, required: true, default: 'Daily Lead Generation', trim: true },
    period_start: { type: String, required: true, default: 'Aug 18, 2026' },
    period_end: { type: String, required: true, default: 'Aug 18, 2026' },
    total_target: { type: Number, required: true, default: 15 },
    achieved: { type: Number, default: 0 },
    is_completed: { type: Boolean, default: false },
    metric_type: { type: String, default: 'Leads Generated' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

export const EmployeeTask =
  mongoose.models.EmployeeTask || mongoose.model<IEmployeeTask>('EmployeeTask', EmployeeTaskSchema);

export default EmployeeTask;
