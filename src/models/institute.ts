import mongoose, { Schema, Document } from 'mongoose';

export interface IInstitute extends Document {
  name: string;
  type?: string;
  district?: string;
  address?: string;
  contact_person?: string;
  contact_phone?: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InstituteSchema = new Schema<IInstitute>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      default: 'College',
      trim: true,
    },
    district: {
      type: String,
      default: 'Ernakulam',
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    contact_person: {
      type: String,
      default: '',
      trim: true,
    },
    contact_phone: {
      type: String,
      default: '',
      trim: true,
    },
    email: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Institute =
  mongoose.models.Institute ||
  mongoose.model<IInstitute>('Institute', InstituteSchema);

export default Institute;
