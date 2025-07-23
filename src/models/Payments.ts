import mongoose, { model, Schema, Document } from "mongoose";
import { z } from "zod";

// Payment Interface
export interface PaymentDocument extends Document {
  tran_id: string;
  order: Schema.Types.ObjectId;
  customer: Schema.Types.ObjectId;
  method: "cash" | "bkash" | "nagad" | "card";
  status: "pending" | "paid" | "failed" | "refunded";
  amount: number;
}

const paymentZodValidation = z.object({
  tran_id: z.string(),
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
  status: z.enum(["pending", "paid", "failed", "refunded"]),
  amount: z.number(),
  transactionId: z.string().optional(),
});

// Payment Schema
const paymentSchema = new Schema<PaymentDocument>(
  {
    tran_id: { type: String },
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    method: {
      type: String,
      enum: ["cash", "bkash", "nagad", "card"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    amount: { type: Number, required: true },
  },
  { timestamps: true }
);

const PaymentModel = model<PaymentDocument>("Payment", paymentSchema);

export default PaymentModel;
