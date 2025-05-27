import { model, Schema } from "mongoose";
import { z } from "zod";

// Category Interface
export interface CategoryDocument extends Document {
  slug: string;
  name: string;
  shortDescription?: string;
  longDescription?: string;
}

// Category validatoin with zod
const categoryZodValidation = z.object({
  slug: z.string(),
  name: z.string(),
  shortDescription: z.string().optional(),
  longDescription: z.string().optional(),
});

// Category Schema
const categorySchema = new Schema<CategoryDocument>(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    shortDescription: { type: String },
    longDescription: { type: String },
  },
  { timestamps: true }
);

// Middleware: Validate with Zod before saving
categorySchema.pre("save", function (next) {
  const validation = this.isNew
    ? categoryZodValidation.safeParse(this.toObject())
    : categoryZodValidation.partial().safeParse(this.toObject());

  if (!validation.success) {
    console.log(`Error on field: ${validation.error.issues[0].path[0]}`);
    console.log(
      validation.error.issues.map((issue) => {
        console.log(issue.message);
        console.log(issue.path[0]);
      })
    );
    return next(new Error(validation.error.issues[0].message));
  }
  next();
});

const CategoryModel = model<CategoryDocument>("Category", categorySchema);

export default CategoryModel;
