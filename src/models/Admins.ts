import { Schema, model, Document } from "mongoose";
import bcrypt from "bcrypt";
import crypto from "crypto";
import z from "zod";

// Admin Interface
export interface AdminDocument extends Document {
  name: string;
  phone: string;
  email: string;
  address: string;
  role: "admin" | "super_admin";
  password: string;
  avatar?: string;
  refresh?: string;
  resetPasswordToken?: string | null;
  resetPasswordExpireDate?: Date | null;

  matchPassword: (pass: string) => Promise<boolean>;
  generateResetPasswordToken: (expMinutes?: number) => string;
}

// Admin Validation with zod
export const adminZodValidation = z.object({
  name: z.string().min(3).max(50),
  email: z.string().email(),
  phone: z
    .string()
    .regex(
      /^01\d{9}$/,
      "Phone number must start with 01 and be exactly 11 digits"
    ),
  address: z.string().max(100, "Address must be less than 100 characters long"),
});

//  Admin Schema
const adminSchema = new Schema<AdminDocument>(
  {
    name: { type: String, required: true, minlength: 3, maxlength: 50 },
    phone: { type: String, required: true, unique: true, match: /^01\d{9}$/ },
    email: { type: String, unique: true, sparse: true },
    address: { type: String, maxlength: 100 },
    role: { type: String, enum: ["admin", "super_admin"], required: true },
    password: { type: String, minlength: 8 },
    avatar: { type: String },
    refresh: { type: String },
    resetPasswordToken: { type: String },
    resetPasswordExpireDate: { type: Date },
  },
  { timestamps: true }
);

// Method to generate and hash reset token
adminSchema.methods.generateResetPasswordToken = function (expMinutes = 30) {
  let resetToken = crypto.randomBytes(32).toString("hex");

  // Hash the token and save it in the database
  resetToken = this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Set token expiration
  this.resetPasswordExpireDate = Date.now() + expMinutes * 60 * 1000; // default 30 minutes

  return resetToken;
};

// Match Admin entered password to hashed password in database
adminSchema.methods.matchPassword = async function (enteredPassword: string) {
  return bcrypt.compare(enteredPassword, this.password);
};

// Hash password
adminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    // If password is not modified, skip hashing
    next();
  }

  if (!this.password) {
    return next(new Error("Password is required"));
  }

  // Use bcrypt to hash the password
  const salt = await bcrypt.genSalt(10); // Adjust salt rounds as needed
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Mongoose Admin model
const Admin = model<AdminDocument>("Admin", adminSchema);

export default Admin;
