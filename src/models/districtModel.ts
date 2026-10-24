import mongoose from "mongoose";

export interface IDistrict {
  _id?: string;
  name: string;
  zone: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

const districtSchema = new mongoose.Schema<IDistrict>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    zone: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

export const District =
  mongoose.models.district ||
  mongoose.models.District ||
  mongoose.model<IDistrict>("district", districtSchema);

export default District;
