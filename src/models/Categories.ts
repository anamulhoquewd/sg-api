import { model, Schema, Document } from "mongoose";

// Category Interface
export interface CategoryDocument extends Document {
  slug: string;
  name: string;
  description?: string;
  avatar: string;
  _id: string;
}

// Category Schema
const categorySchema = new Schema<CategoryDocument>(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    avatar: { type: String, default: "" },
  },
  { timestamps: true }
);

const CategoryModel = model<CategoryDocument>("Category", categorySchema);

export default CategoryModel;
