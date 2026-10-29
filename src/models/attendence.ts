import mongoose, { Schema, Document } from 'mongoose';

export interface IAttendance extends Document {
  name: string;
  designation?: string;
  district?: string;
  date: string; // YYYY-MM-DD
  check_in?: string;
  check_out?: string;
  hours_worked: number;
  status: 'ONLINE' | 'OFFLINE';
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    name: {
      type: String,
      required: [true, 'Staff name is required'],
      trim: true,
    },
    designation: {
      type: String,
      default: 'Field Staff',
      trim: true,
    },
    district: {
      type: String,
      default: 'Kerala',
      trim: true,
    },
    date: {
      type: String,
      default: () => new Date().toISOString().split('T')[0],
    },
    check_in: {
      type: String,
      default: '09:00 AM',
    },
    check_out: {
      type: String,
      default: '06:00 PM',
    },
    hours_worked: {
      type: Number,
      default: 8,
    },
    status: {
      type: String,
      enum: ['ONLINE', 'OFFLINE'],
      default: 'ONLINE',
    },
  },
  {
    timestamps: true,
  }
);

// One attendance row per employee per day. The check-in endpoint catches
// duplicate-key errors so a double tap / concurrent request cannot create a
// second row for the same person.
AttendanceSchema.index({ name: 1, date: 1 }, { unique: true });

// Prevent model recompilation during Next.js hot-reloads
export const Attendance =
  mongoose.models.Attendance || mongoose.model<IAttendance>('Attendance', AttendanceSchema);
export default Attendance;
