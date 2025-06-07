import { model, Schema, Document } from "mongoose";
import { z } from "zod";

// User (Customer) Interface
export interface CustomerDocument extends Document {
  name: string;
  phone: string;
  address: string;
}

export const customerZodValidation = z.object({
  name: z.string().min(3).max(50),
  phone: z
    .string()
    .regex(
      /^01\d{9}$/,
      "Phone number must start with 01 and be exactly 11 digits"
    ),
  address: z.string().max(100),
});

// User (Customer) Schema
const customerSchema = new Schema<CustomerDocument>(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true, match: /^01\d{9}$/ },
    address: { type: String, required: true },
  },
  { timestamps: true }
);

const CustomerModel = model<CustomerDocument>("Customer", customerSchema);

export default CustomerModel;
