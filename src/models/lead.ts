import mongoose, { Schema, Document } from 'mongoose';

export interface ILead extends Document {
  lead_id?: string;
  student_id?: string;
  legacy_id?: number;
  name: string;
  phone?: string;
  contact_number?: string;
  whats_number?: string;
  whatsapp_number?: string;
  email?: string;
  district?: string;
  place?: string;
  address?: string;
  age?: number;
  qualification?: string;
  college_name?: string;
  current_year?: string;
  interested_areas?: string;
  interested_topic?: string;
  interested_course?: string;
  course?: string;
  employee?: string;
  employee_id?: string;
  asm_id?: string;
  asm_name?: string;
  team?: string;
  source?: string;
  lead_source?: string;
  student_interest?: string;
  admission_status?: string;
  status: any;
  payment_verification?: string;
  payment_amount?: number;
  admission_date?: Date;
  incentive_amount?: number;
  incentive_status?: string;
  next_followup_date?: string;
  remarks?: string;
  notes?: string;
  followups?: any[];
  proof_url?: string;
  presentation?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    lead_id: {
      type: String,
      trim: true,
      index: true,
    },
    student_id: {
      type: String,
      trim: true,
      index: true,
    },
    legacy_id: {
      type: Number,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Lead name is required'],
      trim: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    contact_number: {
      type: String,
      default: '',
      trim: true,
    },
    whats_number: {
      type: String,
      default: '',
      trim: true,
    },
    whatsapp_number: {
      type: String,
      default: '',
      trim: true,
    },
    email: {
      type: String,
      default: '',
      trim: true,
    },
    district: {
      type: String,
      default: 'Ernakulam',
      trim: true,
    },
    place: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    age: {
      type: Number,
    },
    qualification: {
      type: String,
      default: '',
      trim: true,
    },
    college_name: {
      type: String,
      default: '',
      trim: true,
    },
    current_year: {
      type: String,
      default: '',
      trim: true,
    },
    interested_areas: {
      type: String,
      default: '',
      trim: true,
    },
    interested_topic: {
      type: String,
      default: '',
      trim: true,
    },
    interested_course: {
      type: String,
      default: '',
      trim: true,
    },
    course: {
      type: String,
      default: '',
      trim: true,
    },
    employee: {
      type: String,
      default: 'Unassigned',
      trim: true,
    },
    employee_id: {
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
    team: {
      type: String,
      default: '',
      trim: true,
    },
    source: {
      type: String,
      default: 'Campus Drive / College Seminar',
      trim: true,
    },
    lead_source: {
      type: String,
      default: 'Campus Drive / College Seminar',
      trim: true,
    },
    student_interest: {
      type: String,
      default: 'Warm',
      trim: true,
    },
    admission_status: {
      type: String,
      default: 'New',
      trim: true,
    },
    status: {
      type: Schema.Types.Mixed,
      default: 1, // 1: New, 2: Follow-up / Contacted, 3: In Progress, 4: Admitted, 5: Closed
    },
    payment_verification: {
      type: String,
      enum: ['Pending', 'Verified', 'Unverified'],
      default: 'Pending',
    },
    payment_amount: {
      type: Number,
      default: 0,
    },
    admission_date: {
      type: Date,
    },
    incentive_amount: {
      type: Number,
      default: 0,
    },
    incentive_status: {
      type: String,
      default: 'Pending',
    },
    next_followup_date: {
      type: String,
      default: '',
    },
    remarks: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
    followups: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    proof_url: {
      type: String,
      default: '',
    },
    presentation: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    strict: false,
  }
);

if (mongoose.models.Lead) {
  mongoose.deleteModel('Lead');
}

export const Lead = mongoose.model<ILead>('Lead', LeadSchema);
export default Lead;
