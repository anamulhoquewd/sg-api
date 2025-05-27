import mongoose, { model, Schema, Document } from "mongoose";
import { z } from "zod";

// Order Interface
export interface OrderDocument extends Document {
  customer: Schema.Types.ObjectId;
  items: {
    product: Schema.Types.ObjectId;
    quantity: number;
    unit: "kg" | "piece";
  }[];
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  totalAmount: number;
  paymentStatus: "unpaid" | "paid";
  deliveryAddress: string;
}

// Customers validation with zod
const customerZodValidation = z.object({
  customer: z
    .any()
    .transform((val) =>
      val instanceof mongoose.Types.ObjectId ? val.toString() : val
    )
    .refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: "Invalid MongoDB Document ID format",
    }),
  items: z.array(
    z.object({
      product: z
        .any()
        .transform((val) =>
          val instanceof mongoose.Types.ObjectId ? val.toString() : val
        )
        .refine((val) => mongoose.Types.ObjectId.isValid(val), {
          message: "Invalid MongoDB Document ID format",
        }),
      quantity: z.number().min(1, "Quantity must be at least 1"),
      unit: z.enum(["kg", "piece"]),
    })
  ),

  status: z.enum([
    "pending",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ]),
  totalAmount: z.number().nonnegative(),
  paymentStatus: z.enum(["unpaid", "paid"]),
  deliveryAddress: z.string().min(5).max(200),
});

// Order Schema
const orderSchema = new Schema<OrderDocument>(
  {
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: [
      {
        product: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: { type: Number, required: true },
        unit: { type: String, enum: ["kg", "piece"], required: true },
      },
    ],
    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    totalAmount: { type: Number, required: true },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid"],
      default: "unpaid",
    },
    deliveryAddress: { type: String, required: true },
  },
  { timestamps: true }
);

// Middleware: Validate with Zod before saving
orderSchema.pre("save", function (next) {
  const validation = this.isNew
    ? customerZodValidation.safeParse(this.toObject())
    : customerZodValidation.partial().safeParse(this.toObject());

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

const OrderModel = model<OrderDocument>("Order", orderSchema);

export default OrderModel;
