import mongoose, { Schema, Document } from 'mongoose';

export interface IEmployee extends Document {
  employee_id: string;
  name: string;
  email?: string;
  contact_number?: string;
  designation?: string;
  district?: string;
  zone?: string;
  team?: string;
  upi_id?: string;
  password?: string;
  bank_name?: string;
  account_holder_name?: string;
  account_number?: string;
  ifsc_code?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeSchema = new Schema<IEmployee>(
  {
    employee_id: {
      type: String,
      default: () => `EMP-${Date.now().toString().slice(-4)}`,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Employee name is required'],
      trim: true,
    },
    email: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },
    contact_number: {
      type: String,
      default: '',
    },
    designation: {
      type: String,
      default: '',
      trim: true,
    },
    district: {
      type: String,
      default: 'Ernakulam',
      trim: true,
    },
    zone: {
      type: String,
      default: 'Central Zone',
      trim: true,
    },
    team: {
      type: String,
      default: 'Team Kakkanad',
      trim: true,
    },
    upi_id: {
      type: String,
      default: '',
    },
    password: {
      type: String,
      default: '',
      select: false,
    },
    bank_name: {
      type: String,
      default: '',
      trim: true,
    },
    account_holder_name: {
      type: String,
      default: '',
      trim: true,
    },
    account_number: {
      type: String,
      default: '',
      trim: true,
    },
    ifsc_code: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      default: 'active',
      lowercase: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent model recompilation during Next.js hot-reloads
export const Employee =
  mongoose.models.Employee || mongoose.model<IEmployee>('Employee', EmployeeSchema);
export default Employee;
