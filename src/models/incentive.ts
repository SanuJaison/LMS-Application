import mongoose, { Schema, Document } from 'mongoose';

export interface IIncentive extends Document {
  lead_id: string;
  student_id: string;
  student_name: string;
  course: string;
  bde_id: string;
  bde_name: string;
  asm_id?: string;
  asm_name?: string;
  team?: string;
  amount: number;
  status: 'Earned' | 'Pending Withdrawal' | 'Withdrawn' | 'Paid';
  admission_date: Date;
  paid_date?: Date;
  transaction_id?: string;
  createdAt: Date;
  updatedAt: Date;
}

const IncentiveSchema = new Schema<IIncentive>(
  {
    lead_id: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    student_id: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    student_name: {
      type: String,
      required: true,
      trim: true,
    },
    course: {
      type: String,
      default: '',
      trim: true,
    },
    bde_id: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    bde_name: {
      type: String,
      required: true,
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
    team: {
      type: String,
      default: '',
      trim: true,
    },
    amount: {
      type: Number,
      default: 1000,
    },
    status: {
      type: String,
      enum: ['Earned', 'Pending Withdrawal', 'Withdrawn', 'Paid'],
      default: 'Earned',
    },
    admission_date: {
      type: Date,
      default: Date.now,
    },
    paid_date: {
      type: Date,
    },
    transaction_id: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

if (mongoose.models.Incentive) {
  mongoose.deleteModel('Incentive');
}

export const Incentive = mongoose.model<IIncentive>('Incentive', IncentiveSchema);
export default Incentive;
