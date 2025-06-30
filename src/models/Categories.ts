import { model, Schema } from "mongoose";
import { z } from "zod";

// Category Interface
export interface CategoryDocument extends Document {
  slug: string;
  name: string;
  description?: string;
}

// Category validatoin with zod
export const categoryZodValidation = z.object({
  slug: z.string().optional(),
  name: z.string().optional(),
  description: z.string().max(250).optional(),
});

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
