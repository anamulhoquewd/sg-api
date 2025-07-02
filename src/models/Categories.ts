import { model, Schema } from "mongoose";

// Category Interface
export interface CategoryDocument extends Document {
  slug: string;
  name: string;
  description?: string;
}

// Category Schema
const categorySchema = new Schema<CategoryDocument>(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
  },
  { timestamps: true }
);

const CategoryModel = model<CategoryDocument>("Category", categorySchema);

export default CategoryModel;
