import mongoose, { Schema, Document } from 'mongoose';

export interface IAttendanceSession {
  check_in: string;
  check_out?: string;
  hours_worked?: string | number;
  latitude?: number;
  longitude?: number;
  address?: string;
  notes?: string;
  created_at?: Date;
}

export interface IAttendance extends Document {
  employee_id?: string;
  name: string;
  designation?: string;
  district?: string;
  date: string; // YYYY-MM-DD
  check_in?: string;
  check_out?: string;
  hours_worked: string | number;
  status: 'ONLINE' | 'OFFLINE';
  sessions?: IAttendanceSession[];
  latitude?: number;
  longitude?: number;
  address?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    employee_id: {
      type: String,
      trim: true,
      default: '',
    },
    name: {
      type: String,
      required: [true, 'Staff name is required'],
      trim: true,
    },
    designation: {
      type: String,
      default: 'Business Development Executive',
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
      default: '',
    },
    check_out: {
      type: String,
      default: '',
    },
    hours_worked: {
      type: Schema.Types.Mixed,
      default: '0 hours',
    },
    status: {
      type: String,
      enum: ['ONLINE', 'OFFLINE'],
      default: 'ONLINE',
    },
    sessions: [
      {
        check_in: { type: String, default: '' },
        check_out: { type: String, default: '' },
        hours_worked: { type: Schema.Types.Mixed, default: '0 hours' },
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null },
        address: { type: String, default: '' },
        notes: { type: String, default: '' },
        created_at: { type: Date, default: Date.now },
      },
    ],
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    address: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

if (mongoose.models.Attendance) {
  mongoose.deleteModel('Attendance');
}

export const Attendance = mongoose.model<IAttendance>('Attendance', AttendanceSchema);
export default Attendance;
