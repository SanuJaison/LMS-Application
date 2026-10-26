import mongoose, { Schema, Document } from 'mongoose';

export interface IInstitute extends Document {
  institute_name: string;
  person_name: string;
  position: string;
  phone: string;
  email?: string;
  district?: string;
  place?: string;
  notes?: string;
  legacy_id?: number; // numeric id for the mobile app
  created_by: string; // ASM name
  created_by_id: string; // ASM employee id, e.g. ASM001
  createdAt: Date;
  updatedAt: Date;
}

const InstituteSchema = new Schema<IInstitute>(
  {
    institute_name: {
      type: String,
      required: [true, 'Institute name is required'],
      trim: true,
    },
    person_name: {
      type: String,
      required: [true, 'Institute person name is required'],
      trim: true,
    },
    position: {
      type: String,
      default: '',
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Contact number is required'],
      trim: true,
    },
    email: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },
    district: {
      type: String,
      default: '',
      trim: true,
    },
    place: {
      type: String,
      default: '',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    legacy_id: {
      type: Number,
      index: true,
    },
    created_by: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    created_by_id: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Prevent model recompilation during Next.js hot-reloads
export const Institute =
  mongoose.models.Institute || mongoose.model<IInstitute>('Institute', InstituteSchema);
export default Institute;
