import mongoose, { Schema, model, Document } from "mongoose";
import { z } from "zod";

// 🔹 Zod Schema
const orderSchemaZod = z.object({
  customerId: z
    .any()
    .transform((val) =>
      val instanceof mongoose.Types.ObjectId ? val.toString() : val
    )
    .refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: "Invalid MongoDB User ID format",
    }),
  customerName: z.string().min(3).max(50),
  customerPhone: z
    .string()
    .regex(
      /^01\d{9}$/,
      "Phone number must start with 01 and be exactly 11 digits"
    ),
  price: z.number().min(1),
  quantity: z.number().min(1),
  item: z.enum(["lunch", "dinner", "lunch&dinner"]),
  date: z.date(),
  note: z.string().optional(),
});

// 🔹 Mongoose Schema
interface IOrder extends Document {
  customerId: mongoose.Types.ObjectId;
  customerName: string;
  customerPhone: string;
  price: number;
  quantity: number;
  total?: number;
  item: string;
  date: Date;
  note?: string;
}

// 🔹 Mongoose Schema
const orderSchema = new Schema<IOrder>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    total: { type: Number },
    item: {
      type: String,
      required: true,
      enum: ["lunch", "dinner", "lunch&dinner"],
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    note: { type: String },
  },
  { timestamps: true }
);

// 🔹 Middleware: Calculate total
orderSchema.pre("save", function (this: IOrder, next) {
  if (this.price && this.quantity) {
    this.total = this.price * this.quantity;
  }
  next();
});

// 🔹 Middleware: Validate with Zod before saving
orderSchema.pre("save", function (next) {
  const validation = orderSchemaZod.safeParse(this.toObject());
  if (!validation.success) {
    console.log(`Error on field: ${validation.error.issues[0].path[0]}`);
    console.log(validation.error.issues[0].message);
    return next(new Error(validation.error.issues[0].message));
  }
  next();
});

// 🔹 Mongoose order model
const Order = model<IOrder>("Order", orderSchema);

export default Order;
