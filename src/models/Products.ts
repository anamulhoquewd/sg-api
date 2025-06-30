import mongoose, { model, Schema } from "mongoose";
import { optional, z } from "zod";

// Product Interface
export interface ProductUnit {
  unitType: "kg" | "piece";
  price: number;
  costPerItem: number;
  stockQuantity: number;
  averageWeightPerFruit?: string;
}

export interface ProductDocument extends Document {
  slug: string;
  name: string;
  title: string;
  origin?: string;
  shortDescription?: string;
  longDescription?: string;
  season?: string;
  media: { alt: string; url: string }[];
  status: "inStock" | "lowStock" | "outOfStock";
  visibility: boolean;
  isPopular: boolean;
  lowStockThreshold: number;
  unit: ProductUnit;
  category: Schema.Types.ObjectId;
}

// Product validation with zod
export const productZodValidation = z.object({
  slug: z
    .string()
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      "Slug must be lowercase letters, numbers, and hyphens only (no spaces or special characters)."
    ),
  name: z
    .string()
    .min(5, { message: "Product name must be at least 5 characters." }),
  title: z
    .string()
    .min(10, { message: "Product title must be at least 10 characters." })
    .optional(),
  shortDescription: z
    .string()
    .min(20, { message: "Short description must be at least 20 characters." })
    .optional(),
  longDescription: z
    .string()
    .min(50, { message: "Long description must be at least 50 characters." })
    .optional(),
  origin: z.string().optional(),

  category: z
    .string()
    .length(24, { message: "Invalid category ID" })
    .regex(/^[a-fA-F0-9]{24}$/, { message: "Invalid ObjectId format" }),
  status: z.enum(["inStock", "lowStock", "outOfStock"]),
  isPopular: z.boolean().default(false),
  visibility: z.boolean().default(true),
  season: z.string().optional(),

  unit: z.object({
    unitType: z.enum(["kg", "piece"]),
    averageWeightPerFruit: z.string(),
    price: z.coerce
      .number()
      .positive({ message: "Original Price must be a positive number." }),
    costPerItem: z.coerce
      .number()
      .nonnegative({ message: "Cost must be a non-negative number." })
      .optional(),
    stockQuantity: z.coerce.number().nonnegative({
      message: "Stock quantity must be a non-negative number.",
    }),
  }),

  lowStockThreshold: z.coerce.number().nonnegative().default(20),
  averageWeightPerFruit: z.string().optional(),

  media: z
    .array(z.object({ url: z.string().url(), alt: z.string() }))
    .min(1, { message: "At least one media URL is required." }),
});

// Product Schema
const productSchema = new Schema<ProductDocument>(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    title: { type: String, required: true },
    origin: { type: String },
    shortDescription: { type: String },
    longDescription: { type: String },
    media: [{ alt: String, url: String, _id: false }],
    status: {
      type: String,
      enum: ["inStock", "lowStock", "outOfStock"],
      required: true,
      default: "inStock",
    },
    visibility: { type: Boolean, default: true },
    season: { type: String },
    isPopular: { type: Boolean, default: false },
    lowStockThreshold: { type: Number, default: 20 },
    unit: {
      unitType: { type: String, enum: ["kg", "piece"], required: true },
      price: { type: Number, require: true },
      costPerItem: { type: Number, required: true },
      stockQuantity: { type: Number, required: true },
      averageWeightPerFruit: { type: String },
    },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
  },
  { timestamps: true }
);

const ProductModel = model<ProductDocument>("Product", productSchema);

export default ProductModel;
