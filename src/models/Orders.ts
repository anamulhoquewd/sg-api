import mongoose, { model, Schema, Document } from "mongoose";
import { z } from "zod";

// Order Interface
export interface OrderItem {
  product: Schema.Types.ObjectId;
  quantity: number;
  name: string;
  price: number;
  total: number;
}
export interface OrderDocument extends Document {
  customer: Schema.Types.ObjectId;
  items: OrderItem[];
  deliveryCost: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  amount: number;
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  address: string;
}

// Customers validation with zod
export const orderZodValidation = z.object({
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
    })
  ),
  address: z.string().max(200),
  name: z.string(),
  phone: z
    .string()
    .regex(
      /^01\d{9}$/,
      "Phone number must start with 01 and be exactly 11 digits"
    ),
  deliveryCost: z.number(),
});

// Order Schema
const orderSchema = new Schema<OrderDocument>(
  {
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    items: [
      {
        _id: false,
        product: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: { type: Number, required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        total: { type: Number, required: true },
      },
    ],
    deliveryCost: { type: Number, require: true },
    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    amount: { type: Number, required: true },
    address: { type: String, required: true },
  },
  { timestamps: true }
);

const OrderModel = model<OrderDocument>("Order", orderSchema);

export default OrderModel;
