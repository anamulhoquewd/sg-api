import mongoose, { model, Schema, Document } from "mongoose";
import { z } from "zod";

// Order Interface
export interface OrderDocument extends Document {
  customer: Schema.Types.ObjectId;
  items: {
    product: Schema.Types.ObjectId;
    quantity: number;
  }[];
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  amount: number;
  paymentStatus: "unpaid" | "paid";
  deliveryAddress: string;
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
  deliveryAddress: z.string().min(5).max(200),
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
      },
    ],
    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    amount: { type: Number, required: true },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid"],
      default: "unpaid",
    },
    deliveryAddress: { type: String, required: true },
  },
  { timestamps: true }
);

const OrderModel = model<OrderDocument>("Order", orderSchema);

export default OrderModel;
