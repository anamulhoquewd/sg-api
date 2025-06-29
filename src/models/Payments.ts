import mongoose, { model, Schema, Document } from "mongoose";
import { z } from "zod";

// Payment Interface
export interface PaymentDocument extends Document {
  order: Schema.Types.ObjectId;
  customer: Schema.Types.ObjectId;
  method: "cash" | "bkash" | "nagad" | "card";
  status: "pending" | "paid" | "failed";
  amount: number;
  transactionId?: string;
}

const paymentZodValidation = z.object({
  order: z
    .any()
    .transform((val) =>
      val instanceof mongoose.Types.ObjectId ? val.toString() : val
    )
    .refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: "Invalid MongoDB Document ID format",
    }),
  customer: z
    .any()
    .transform((val) =>
      val instanceof mongoose.Types.ObjectId ? val.toString() : val
    )
    .refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: "Invalid MongoDB Product ID format",
    }),
  method: z.enum(["cash", "bkash", "nagad", "card"]),
  status: z.enum(["pending", "paid", "failed"]),
  amount: z.number(),
  transactionId: z.string().optional(),
});

// Payment Schema
const paymentSchema = new Schema<PaymentDocument>(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    method: {
      type: String,
      enum: ["cash", "bkash", "nagad", "card"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    amount: { type: Number, required: true },
    transactionId: { type: String },
  },
  { timestamps: true }
);

const PaymentModel = model<PaymentDocument>("Payment", paymentSchema);

export default PaymentModel;
