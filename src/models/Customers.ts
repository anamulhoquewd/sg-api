import { model, Schema, Document } from "mongoose";
import { z } from "zod";

// User (Customer) Interface
export interface CustomerDocument extends Document {
  name: string;
  phone: string;
  address: string;
}

const customerZodValidation = z.object({
  name: z.string(),
  phone: z
    .string()
    .regex(
      /^01\d{9}$/,
      "Phone number must start with 01 and be exactly 11 digits"
    ),
  address: z.string().max(200),
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

// Middleware: Validate with Zod before saving
customerSchema.pre("save", function (next) {
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

const CustomerModel = model<CustomerDocument>("Customer", customerSchema);

export default CustomerModel;
