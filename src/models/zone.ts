import mongoose, { Schema, Document } from 'mongoose';

export interface IZone extends Document {
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ZoneSchema = new Schema<IZone>(
  {
    name: {
      type: String,
      required: [true, 'Zone name is required'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent model recompilation during Next.js hot-reloads
export const Zone = mongoose.models.Zone || mongoose.model<IZone>('Zone', ZoneSchema);
export default Zone;
