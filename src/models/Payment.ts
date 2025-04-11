import mongoose, { Schema, model, Document } from "mongoose";
import { z } from "zod";

// 🔹 Zod Schema
const paymentSchemaZod = z.object({
  customerId: z
    .any()
    .transform((val) =>
      val instanceof mongoose.Types.ObjectId ? val.toString() : val
    )
    .refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: "Invalid MongoDB User ID format",
    }),
  amount: z.number().min(1),
  note: z.string().optional(),
  name: z.string(),
  transactionDetails: z.object({
    paymentMethod: z.enum(["bank", "bkash", "nagad", "cash"]),
    transactionId: z.string().optional(),
    bankName: z.string().optional(),
    bkashNumber: z
      .string()
      .regex(
        /^01\d{9}$/,
        "Phone number must start with 01 and be exactly 11 digits"
      )
      .optional(),
    nagadNumber: z
      .string()
      .regex(
        /^01\d{9}$/,
        "Phone number must start with 01 and be exactly 11 digits"
      )
      .optional(),
    cashReceivedBy: z.string().optional(),
  }),
});

// 🔹 Mongoose Payment Schema
export interface IPaymentDoc extends Document {
  customerId: Schema.Types.ObjectId;
  name: string;
  amount: number;
  note: string;
  transactionDetails: {
    paymentMethod: "bank" | "bkash" | "nagad" | "cash";
    transactionId: string;
    bankName: string;
    bkashNumber: string;
    nagadNumber: string;
    cashReceivedBy: string;
  };
}

// 🔹 Mongoose Payment Schema
const paymentSchema = new Schema<IPaymentDoc>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    name: { type: String },
    amount: { type: Number, required: true },
    note: { type: String },
    transactionDetails: {
      paymentMethod: {
        type: String,
        enum: ["bank", "bkash", "nagad", "cash"],
        required: true,
      },
      transactionId: { type: String },
      bankName: { type: String },
      bkashNumber: { type: String },
      nagadNumber: { type: String },
      cashReceivedBy: { type: String },
    },
  },
  { timestamps: true }
);

// 🔹 Middleware: Validate with Zod before saving
paymentSchema.pre("save", function (next) {
  const validation = paymentSchemaZod.safeParse(this.toObject());
  if (!validation.success) {
    console.log(`Error on field: ${validation.error.issues[0].path[0]}`);
    console.log(validation.error.issues[0].message);
    return next(new Error(validation.error.issues[0].message));
  }
  next();
});

const Payment = model<IPaymentDoc>("Payment", paymentSchema);

export default Payment;
