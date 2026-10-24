import mongoose from "mongoose";

export interface IDesignation {
  _id?: string;
  name: string;
  prefix: string;
  createdAt?: string;
  updatedAt?: string;
}

const designationSchema = new mongoose.Schema<IDesignation>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    prefix: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

export default mongoose.models.designation ||
  mongoose.models.Designation ||
  mongoose.model<IDesignation>("designation", designationSchema);
