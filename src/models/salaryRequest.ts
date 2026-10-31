import mongoose, { Schema, Document } from 'mongoose';

export interface ISalaryRequest extends Document {
  request_id: string;
  employee_id: string;
  employee_name: string;
  designation?: string;
  team?: string;
  asm_id?: string;
  asm_name?: string;
  sm_id?: string;
  sm_name?: string;
  amount: number;
  period: string;
  attendance_days?: number;
  remarks?: string;
  status:
    | 'Submitted to ASM'
    | 'Forwarded to SM'
    | 'Forwarded to Accounts'
    | 'Approved'
    | 'Rejected'
    | 'Paid';
  approval_history: Array<{
    step: string;
    actor: string;
    role: string;
    action: string;
    remarks?: string;
    timestamp: Date;
  }>;
  transaction_reference?: string;
  payment_date?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SalaryRequestSchema = new Schema<ISalaryRequest>(
  {
    request_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    employee_id: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    employee_name: {
      type: String,
      required: true,
      trim: true,
    },
    designation: {
      type: String,
      default: 'Business Development Executive',
      trim: true,
    },
    team: {
      type: String,
      default: '',
      trim: true,
    },
    asm_id: {
      type: String,
      default: '',
      trim: true,
    },
    asm_name: {
      type: String,
      default: '',
      trim: true,
    },
    sm_id: {
      type: String,
      default: '',
      trim: true,
    },
    sm_name: {
      type: String,
      default: '',
      trim: true,
    },
    amount: {
      type: Number,
      default: 5000,
      min: [5000, 'Minimum salary request amount is ₹5,000'],
    },
    period: {
      type: String,
      required: true,
      trim: true,
    },
    attendance_days: {
      type: Number,
      default: 30,
    },
    remarks: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: [
        'Submitted to ASM',
        'Forwarded to SM',
        'Forwarded to Accounts',
        'Approved',
        'Rejected',
        'Paid',
      ],
      default: 'Submitted to ASM',
      index: true,
    },
    approval_history: [
      {
        step: { type: String, default: '' },
        actor: { type: String, default: '' },
        role: { type: String, default: '' },
        action: { type: String, default: '' },
        remarks: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    transaction_reference: {
      type: String,
      default: '',
      trim: true,
    },
    payment_date: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

if (mongoose.models.SalaryRequest) {
  mongoose.deleteModel('SalaryRequest');
}

export const SalaryRequest =
  mongoose.model<ISalaryRequest>('SalaryRequest', SalaryRequestSchema);
export default SalaryRequest;
