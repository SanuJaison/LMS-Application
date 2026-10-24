import mongoose from "mongoose";

export interface ICourse {
  _id?: string;
  name: string;
  fee?: number;
  duration?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

const courseSchema = new mongoose.Schema<ICourse>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    fee: {
      type: Number,
      default: 20000,
    },
    duration: {
      type: String,
      default: "3 Months",
    },
    status: {
      type: String,
      default: "active",
    },
  },
  { timestamps: true }
);

export const Course =
  mongoose.models.course ||
  mongoose.models.Course ||
  mongoose.model<ICourse>("course", courseSchema);

export default Course;
