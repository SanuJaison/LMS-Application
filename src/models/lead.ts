import mongoose, { Schema, Document } from 'mongoose';

export interface IFollowUpLog {
  _id?: string;
  date: string;
  remarks: string;
  student_interest?: string;
  presentation?: string;
  next_followup_date?: string;
  admission_status?: string;
  proof_url?: string;
  recorded_by?: string;
  createdAt?: Date;
}

export interface ILead extends Document {
  lead_id: string; // Unique Lead ID, e.g., LD-1001
  legacy_id?: number; // Numeric id used by the mobile app (close/follow-up endpoints)

  // Lead Generation Fields (matching Kerala Institute note)
  name: string;
  contact_number: string;
  phone?: string; // compatibility alias
  whats_number?: string; // WhatsApp Number
  whatsapp_number?: string; // compatibility alias
  district: string;
  place?: string;
  age?: number | string;
  qualification?: string;
  college_name?: string; // College Name / Institute Name
  current_year?: string; // Current Year of study / Passed out
  interested_topic?: string; // Interested Topic
  interested_course?: string; // Interested Course
  course?: string; // compatibility alias
  employee?: string; // Assigned BDE / Counselor
  employee_id?: string; // Assigned employee ID, e.g. BDE001
  email?: string;
  address?: string;

  // Follow-Up Fields (matching Kerala Institute note)
  lead_source?: string;
  source?: string; // compatibility alias
  student_interest?: string; // High, Medium, Low, Not Interested
  next_followup_date?: string;
  remarks?: string;
  notes?: string; // compatibility alias
  admission_status?: string; // New, Follow Up, Presentation Scheduled, Admitted, Lost
  status: any; // compatibility alias
  presentation?: string; // Not Scheduled, Scheduled, Completed, Not Attended
  student_id?: string; // Assigned upon Admission, e.g. STU-1001
  proof_url?: string; // Screenshot, Screenrecord proof
  followups?: IFollowUpLog[];

  createdAt: Date;
  updatedAt: Date;
}

const FollowUpLogSchema = new Schema(
  {
    date: {
      type: String,
      default: () => new Date().toISOString().split('T')[0],
    },
    remarks: {
      type: String,
      default: '',
      trim: true,
    },
    student_interest: {
      type: String,
      default: 'Medium',
      trim: true,
    },
    presentation: {
      type: String,
      default: 'Not Scheduled',
      trim: true,
    },
    next_followup_date: {
      type: String,
      default: '',
      trim: true,
    },
    admission_status: {
      type: String,
      default: 'Follow Up',
      trim: true,
    },
    proof_url: {
      type: String,
      default: '',
      trim: true,
    },
    recorded_by: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

const LeadSchema = new Schema<ILead>(
  {
    lead_id: {
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
    contact_number: {
      type: String,
      default: '',
      trim: true,
    },
    phone: {
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
    age: {
      type: Schema.Types.Mixed,
      default: '',
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
      default: '',
      trim: true,
    },
    employee_id: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    email: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },

    // Follow-Up & Admission Tracking
    lead_source: {
      type: String,
      default: 'Cold Call',
      trim: true,
    },
    source: {
      type: String,
      default: 'Cold Call',
      trim: true,
    },
    student_interest: {
      type: String,
      default: 'Medium',
      trim: true,
    },
    next_followup_date: {
      type: String,
      default: '',
      trim: true,
    },
    remarks: {
      type: String,
      default: '',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    admission_status: {
      type: String,
      default: 'New',
      trim: true,
    },
    status: {
      type: Schema.Types.Mixed,
      default: 'New',
    },
    presentation: {
      type: String,
      default: 'Not Scheduled',
      trim: true,
    },
    student_id: {
      type: String,
      default: '',
      trim: true,
    },
    proof_url: {
      type: String,
      default: '',
      trim: true,
    },
    followups: {
      type: [FollowUpLogSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Prevent model recompilation error during hot reloads while allowing schema updates
if (mongoose.models.Lead) {
  mongoose.deleteModel('Lead');
}
export const Lead = mongoose.model<ILead>('Lead', LeadSchema);
export default Lead;
