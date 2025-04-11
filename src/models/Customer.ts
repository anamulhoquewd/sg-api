import { Schema, model, Document } from "mongoose";
import { z } from "zod";
import crypto from "crypto";

// 🔹 Zod Schema for Customer Validation
const customerSchemaZod = z
  .object({
    name: z.string().min(3).max(20),
    phone: z
      .string()
      .regex(
        /^01\d{9}$/,
        "Phone number must start with 01 and be exactly 11 digits"
      ),
    address: z.string().min(2).max(150),
    defaultItem: z.enum(["lunch", "dinner", "lunch&dinner"], {
      required_error: "Please select a default item",
    }),
    defaultPrice: z.coerce
      .number()
      .positive({ message: "Price must be a positive number" }),
    defaultQuantity: z.coerce
      .number()
      .int()
      .positive({ message: "Quantity must be a positive integer" }),
    defaultOffDays: z.array(z.string()).default([]),
    paymentStatus: z.enum(["paid", "partially_paid", "pending"], {
      required_error: "Please select a payment status",
    }),
    paymentSystem: z.enum(["weekly", "monthly"], {
      required_error: "Please select a payment system",
    }),
    amount: z.number().default(0),
    accessKey: z.string().optional(),
    accessKeyExpiredAt: z.date().optional(),
    active: z.boolean().default(true),
  })
  .refine(
    (data) =>
      data.defaultOffDays?.every((day: string) =>
        ["sa", "su", "mo", "tu", "we", "th", "fr"].includes(day)
      ) ?? true,
    {
      message:
        "Default off days must be in the following order: sa, su, mo, tu, we, th, fr",
      path: ["defaultOffDays"],
    }
  );

// 🔹 Mongoose Schema
interface ICustomer extends z.infer<typeof customerSchemaZod> {}

console.log();

// 🔹 Mongoose Document
interface ICustomerDoc extends Document {
  name: string;
  phone: string;
  address: string;
  defaultItem: "lunch" | "dinner" | "lunch&dinner";
  defaultPrice: number;
  defaultQuantity: number;
  defaultOffDays: ["sa" | "su" | "mo" | "tu" | "we" | "th" | "fr"];
  paymentStatus: "paid" | "partially_paid" | "pending";
  paymentSystem: "weekly" | "monthly";
  amount: number;
  active: boolean;
  accessKey?: string;
  accessKeyExpiredAt?: Date;
  generateAccessKey: (minutes?: number) => string;
}

// 🔹 Mongoose customer scheme
const customerSchema = new Schema<ICustomerDoc>(
  {
    name: { type: String, required: true, minlength: 3, maxlength: 50 },
    phone: { type: String, required: true, unique: true },
    address: { type: String, required: true, maxlength: 100 },
    defaultItem: {
      type: String,
      enum: ["lunch", "dinner", "lunch&dinner"],
      required: true,
    },
    defaultPrice: { type: Number, required: true },
    defaultQuantity: { type: Number, required: true },
    defaultOffDays: {
      type: [String],
      enum: ["sa", "su", "mo", "tu", "we", "th", "fr"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["paid", "partially_paid", "pending"],
      default: "pending",
    },
    paymentSystem: {
      type: String,
      enum: ["weekly", "monthly"],
      default: "weekly",
      required: true,
    },
    amount: { type: Number, default: 0 },
    accessKey: { type: String },
    accessKeyExpiredAt: { type: Date },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// 🔹 Method to generate access key
customerSchema.methods.generateAccessKey = function (minutes: number = 60) {
  const token = crypto.randomBytes(32).toString("hex");
  this.accessKey = crypto.createHash("sha256").update(token).digest("hex");
  this.accessKeyExpiredAt = new Date(Date.now() + 1000 * 60 * minutes);
  return this.accessKey;
};

// 🔹 Middleware: Validate with Zod before saving
customerSchema.pre("save", function (next) {
  const validation = customerSchemaZod.safeParse(this.toObject());
  if (!validation.success) {
    console.log(`Error on field: ${validation.error.issues[0].path[0]}`);
    return next(new Error(validation.error.issues[0].message));
  }
  next();
});

// 🔹 Mongoose customer model
const Customer = model<ICustomerDoc>("Customer", customerSchema);

export default Customer;
