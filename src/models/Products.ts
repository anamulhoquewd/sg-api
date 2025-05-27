import mongoose, { model, Schema } from "mongoose";
import { z } from "zod";

// Product Interface
export interface ProductUnit {
  unit: "kg" | "piece";
  price: number;
  originalPrice?: number;
  costPerItem: number;
  quantity: number;
  season?: {
    start: Date;
    end: Date;
  };
  averageWeightPerFruit?: {
    start: string;
    end: string;
  };
  discount?: {
    type: "percentage" | "flat";
    value: number;
    duration?: {
      start: Date;
      end: Date;
    };
    maxLimitPerUser?: number;
    minPurchaseQty?: number;
    isActive: boolean;
  };
}

export interface ProductDocument extends Document {
  slug: string;
  name: string;
  title: string;
  origin?: string;
  shortDescription?: string;
  longDescription?: string;
  media: { alt: string; url: string }[];
  status: "inStock" | "lowStock" | "outOfStock";
  visibility: boolean;
  popular: boolean;
  lowStockThreshold: number;
  unit: ProductUnit;
  category: Schema.Types.ObjectId;
}

// Product validation with zod
const productZodValidation = z.object({
  slug: z.string(),
  name: z.string(),
  title: z.string(),
  origin: z.string().optional(),
  shortDescription: z.string().optional(),
  longDescription: z.string().optional(),
  media: z.array(z.object({ alt: z.string(), url: z.string() })),
  status: z.enum(["inStock", "lowStock", "outOfStock"]),
  visibility: z.boolean().default(true),
  popular: z.boolean().default(false),
  lowStockThreshold: z.number().default(20),
  category: z
    .any()
    .transform((val) =>
      val instanceof mongoose.Types.ObjectId ? val.toString() : val
    )
    .refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: "Invalid MongoDB Document ID format",
    }),
  unit: z.object({
    unit: z.enum(["kg", "piece"]),
    price: z.number().nonnegative(),
    originalPrice: z.number().nonnegative().optional(),
    costPerItem: z.number().nonnegative().optional(),
    quantity: z.number().nonnegative(),
    season: z
      .object({
        start: z.date(),
        end: z.date(),
      })
      .optional(),
    averageWeightPerFruit: z
      .object({
        start: z.string(),
        end: z.string(),
      })
      .optional(),
  }),
  discount: z
    .object({
      type: z.enum(["percentage", "flat"]),
      value: z.number(),
      duration: z
        .object({
          start: z.date(),
          end: z.date(),
        })
        .optional(),
      maxLimitPerCustomer: z.number().optional(),
      minPurchaseQty: z.number().optional(),
    })
    .optional(),
  isActive: z.boolean(),
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
    media: [{ alt: String, url: String }],
    status: {
      type: String,
      enum: ["inStock", "lowStock", "outOfStock"],
      required: true,
    },
    visibility: { type: Boolean, default: true },
    popular: { type: Boolean, default: false },
    lowStockThreshold: { type: Number, default: 20 },
    unit: {
      unit: { type: String, enum: ["kg", "piece"], required: true },
      price: { type: Number, required: true },
      originalPrice: { type: Number },
      costPerItem: { type: Number, required: true },
      quantity: { type: Number, required: true },
      season: {
        start: Date,
        end: Date,
      },
      averageWeightPerFruit: {
        start: String,
        end: String,
      },
      discount: {
        type: {
          type: String,
          enum: ["percentage", "flat"],
        },
        value: Number,
        duration: {
          start: Date,
          end: Date,
        },
        maxLimitPerUser: Number,
        minPurchaseQty: Number,
        isActive: { type: Boolean, default: true },
      },
    },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
  },
  { timestamps: true }
);

// Middleware: Validate with Zod before saving
productSchema.pre("save", function (next) {
  const validation = this.isNew
    ? productZodValidation.safeParse(this.toObject())
    : productZodValidation.partial().safeParse(this.toObject());

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
const ProductModel = model<ProductDocument>("Product", productSchema);

export default ProductModel;
