import { z } from "zod";
import { stringGenerator } from "../utils";
import { Admin } from "../models";
import nodemailer from "nodemailer";
import { defaults } from "../config/defaults";
import {
  generateAccessToken,
  generateRefreshToken,
  generateS3AccessKey,
  pagination,
  uploadAvatar,
} from "../lib";
import idSchema from "../utils/utils";
import { s3 } from "../config/S3";
import { schemaValidationError } from "./utile";
import { AdminDocument, adminZodValidation } from "../models/Admins";
import { CategoryDocument } from "../models/Categories";

// Get environment variables
const EMAIL_USER = process.env.EMAIL_USER
  ? process.env.EMAIL_USER
  : "example@example.com";
const EMAIL_PASS = process.env.EMAIL_PASS ? process.env.EMAIL_PASS : "password";

// Get environment variables
const name = process.env.ADMIN_NAME;
const email = process.env.ADMIN_EMAIL;
const phone = process.env.ADMIN_PHONE;
const password = process.env.ADMIN_PASSWORD;

// Get environment variables
const AWS_BUCKET_NAME = (process.env.AWS_BUCKET_NAME as string) || "bucket";
const AWS_ACCESS_KEY_ID =
  (process.env.AWS_ACCESS_KEY_ID as string) || "12345678";
const AWS_SECRET_ACCESS_KEY =
  (process.env.AWS_SECRET_ACCESS_KEY as string) || "12345678";
const AWS_REGION = (process.env.AWS_REGION as string) || "eu-north-1";

// Get environment variables
const DOMAIN = process.env.DOMAIN;

// Create Email Transporter config
const transporter = nodemailer.createTransport({
  service: "gmail", // or your email provider
  auth: {
    user: EMAIL_USER, // Your email address
    pass: EMAIL_PASS, // Your email password key
  },
});

export const getAdminsService = async (queryParams: {
  page: number;
  limit: number;
  search: string;
  sortBy: string;
  sortType: string;
  role: string;
}) => {
  const { page, limit, search, sortBy, sortType, role } = queryParams;

  // Validate query parameters
  const querySchema = z.object({
    sortBy: z.enum(["createdAt", "updatedAt", "name", "email"]).optional(),
    sortType: z
      .enum(["asc", "desc"])
      .default(defaults.sortType as "asc" | "desc"),
    role: z.enum(["admin", "super_admin", ""]).optional(),
    search: z.string().optional(),
  });

  // Safe Parse for better error handling
  const queryValidation = querySchema.safeParse({
    search,
    sortBy,
    sortType,
    role,
  });

  // Return error if validation fails
  if (!queryValidation.success) {
    return {
      error: schemaValidationError(
        queryValidation.error,
        "Invalid query parameters"
      ),
    };
  }

  try {
    // Build query
    const query: any = {};
    if (queryValidation.data.search) {
      query.$or = [
        { name: { $regex: queryValidation.data.search, $options: "i" } },
        { email: { $regex: queryValidation.data.search, $options: "i" } },
        { phone: { $regex: queryValidation.data.search, $options: "i" } },
      ];
    }

    if (queryValidation.data.role) {
      query.role = queryValidation.data.role;
    }

    // Allowable sort fields
    const validSortFields = ["createdAt", "updatedAt", "name", "email"];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortDirection =
      queryValidation.data.sortType.toLocaleLowerCase() === "asc" ? 1 : -1;

    // Fetch admin
    const [admins, total] = await Promise.all([
      Admin.find(query)
        .sort({ [sortField]: sortDirection })
        .skip((page - 1) * limit)
        .limit(limit),

      Admin.countDocuments(query),
    ]);

    // Pagination
    const getPagination = pagination({
      page: page,
      limit: limit,
      total,
    });

    return {
      success: {
        success: true,
        message: "Admins fetched successfully",
        data: admins,
        pagination: getPagination,
      },
    };
  } catch (error: any) {
    return {
      serverError: {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
    };
  }
};

export const registerAdminService = async (body: {
  name: string;
  phone: string;
  email: string;
  address: string;
}) => {
  // Safe Parse for better error handling
  const bodyValidation = adminZodValidation.safeParse(body);

  if (!bodyValidation.success) {
    return {
      error: schemaValidationError(
        bodyValidation.error,
        "Invalid request body"
      ),
    };
  }

  // Destructure Body
  const { name, email, phone, address } = bodyValidation.data;

  try {
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({
      $or: [{ email }, { phone }],
    });

    if (existingAdmin) {
      return {
        error: {
          message: "This admin already exists",
          fields: [
            {
              name: "email",
              message: "Email must be unique",
            },
            {
              name: "phone",
              message: "Phone number must be unique",
            },
          ],
        },
      };
    }

    // Generate Password
    const password = stringGenerator(8);

    // Create Admin
    const admin = new Admin({
      name,
      email,
      phone,
      password,
      address,
      role: "admin",
    });

    // Save Admin
    const docs = await admin.save();

    // Send Email to admin
    const mailOptions = {
      from: EMAIL_USER,
      to: email,
      subject: "Your Account Details",
      text: `Hello ${name},\n\nYour account has been created successfully. Here are your login details:\n\nEmail: ${email}\nPassword: ${password}\n\nPlease log in and change your password immediately for security.\n\nThank you!`,
    };

    // Send Email
    await transporter.sendMail(mailOptions);

    return {
      success: {
        success: true,
        message: "User created successfully",
        data: docs,
      },
    };
  } catch (error: any) {
    return {
      serverError: {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
    };
  }
};

export const getSingleAdminService = async (id: string) => {
  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return {
      error: schemaValidationError(idValidation.error, "Invalid Document ID"),
    };
  }

  try {
    // Check if admin exists
    const admin = await Admin.findById(idValidation.data.id);

    if (!admin) {
      return {
        error: {
          message: "admin not found with provided ID",
        },
      };
    }

    return {
      success: {
        success: true,
        message: "Admin fetched successfully",
        data: admin,
      },
    };
  } catch (error: any) {
    return {
      serverError: {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
    };
  }
};

export const updateMeService = async ({
  admin,
  body,
}: {
  admin: AdminDocument;
  body: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
}) => {
  // Validate Body
  const bodySchema = z.object({
    name: z.string().min(2).max(50).optional(),
    email: z.string().email().optional(),
    phone: z
      .string()
      .regex(
        /^01\d{9}$/,
        "Phone number must start with 01 and be exactly 11 digits"
      )
      .optional(),
    address: z.string().min(2).max(100).optional(),
  });

  // Validate Body
  const bodyValidation = bodySchema.safeParse(body);
  if (!bodyValidation.success) {
    return {
      error: schemaValidationError(
        bodyValidation.error,
        "Invalid request body"
      ),
    };
  }

  try {
    // Check if all fields are empty
    if (Object.keys(bodyValidation.data).length === 0) {
      return {
        success: {
          success: true,
          message: "No updates provided, returning existing admin",
          data: admin,
        },
      };
    }

    // Update only provided fields
    Object.assign(admin, bodyValidation.data);

    const docs = await admin.save();

    return {
      success: {
        success: true,
        message: "Admin updated successfully",
        data: docs,
      },
    };
  } catch (error: any) {
    return {
      serverError: {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
    };
  }
};

export const superAdminService = async () => {
  try {
    // Check if super admin already exists
    const existingSuperAdmin = await Admin.findOne({ role: "super_admin" });

    if (existingSuperAdmin) {
      return {
        success: false,
        error: {
          message: "Super Admin already exists",
        },
      };
    }

    // bodySchema the environment variables
    const bodySchema = z.object({
      name: z.string().min(3).max(50),
      email: z.string().email(),
      password: z.string().min(8).max(50),
      phone: z
        .string()
        .regex(
          /^01\d{9}$/,
          "Phone number must start with 01 and be exactly 11 digits"
        ),
    });

    // Safe Parse for better error handling
    const bodyValidation = bodySchema.safeParse({
      name,
      email,
      phone,
      password,
    });

    if (!bodyValidation.success) {
      return {
        success: false,
        error: {
          message: "Validation error",
        },
      };
    }

    // Create Super Admin
    const admin = new Admin({
      name: bodyValidation.data.name,
      email: bodyValidation.data.email,
      phone: bodyValidation.data.phone,
      password: bodyValidation.data.password,
      role: "super_admin",
    });

    // Save Super Admin
    const docs = await admin.save();

    // Response
    return {
      message: "Super Admin created successfully!",
      success: true,
      data: docs,
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
    };
  }
};

export const loginService = async (body: {
  email: string;
  phone: string;
  password: string;
}) => {
  // Validate Body
  const bodyScheme = z
    .object({
      email: z.string().email().optional(),
      phone: z
        .string()
        .length(11, "Phone number must be 11 characters long")
        .optional(),
      password: z.string().min(8).max(20),
    })
    .refine((data) => data.email || data.phone, {
      message: "Either email or phone is required",
      path: ["email"], // Can also use "phone" or leave empty
    });

  // Safe Parse for better error handling
  const bodyValidation = bodyScheme.safeParse(body);

  if (!bodyValidation.success) {
    return {
      error: schemaValidationError(
        bodyValidation.error,
        "Invalid request body"
      ),
    };
  }

  // Destructure Body
  const { email, phone, password } = bodyValidation.data;

  try {
    // Check if admin exists
    const admin = await Admin.findOne({
      $or: [{ email }, { phone }],
    });

    if (!admin) {
      return {
        error: {
          msg: "Invalid credentials",
          fields: [
            {
              name: "email",
              message: "admin not found with this email or phone",
            },
          ],
        },
      };
    }

    // Validate password
    if (!(await admin.matchPassword(password))) {
      return {
        error: {
          msg: "Invalid credentials",
          fields: [
            {
              name: "password",
              message: "Password is incorrect",
            },
          ],
        },
      };
    }

    // Generate access token
    const accessToken = await generateAccessToken({ admin });

    // Generate refresh token
    const refreshToken = await generateRefreshToken({ admin });

    // Refresh token store in database
    admin.refresh = refreshToken;
    await admin.save();

    // Response
    return {
      success: {
        success: true,
        message: "Login successfully!",
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    };
  } catch (error: any) {
    return {
      serverError: {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
    };
  }
};

export const changePasswordService = async ({
  admin,
  body,
}: {
  admin: AdminDocument;
  body: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  };
}) => {
  //  Validate Body
  const bodySchema = z
    .object({
      currentPassword: z.string().min(8).max(20),
      newPassword: z.string().min(8).max(20),
      confirmPassword: z.string().min(8).max(20),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    });

  // Safe Parse for better error handling
  const bodyValidation = bodySchema.safeParse(body);

  if (!bodyValidation.success) {
    return {
      error: schemaValidationError(
        bodyValidation.error,
        "Invalid request body"
      ),
    };
  }

  // Destructure Body
  const { currentPassword, newPassword } = bodyValidation.data;

  try {
    // Validate password
    if (!(await admin.matchPassword(currentPassword))) {
      return {
        error: {
          msg: "Current password is incorrect",
          fields: [
            {
              name: "currentPassword",
              message: "Current Password is incorrect",
            },
          ],
        },
      };
    }

    // Update password
    admin.password = newPassword;
    await admin.save();

    // Response
    return {
      success: {
        success: true,
        message: "Password changed successfully",
      },
    };
  } catch (error: any) {
    return {
      serverError: {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
    };
  }
};

export const deleteAdminService = async (id: string) => {
  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return { error: schemaValidationError(idValidation.error, "Invalid ID") };
  }

  try {
    // Delete admin
    const admin = await Admin.findById(idValidation.data.id);

    if (!admin) {
      return {
        error: {
          message: "Admin not found with the provided ID",
        },
      };
    }

    if (admin.role === "super_admin") {
      return {
        error: {
          message: "It is not possible to delete the super admin.",
        },
      };
    }

    // Delete user
    await admin.deleteOne();

    // Response
    return {
      success: {
        success: true,
        message: "User deleted successfully",
      },
    };
  } catch (error: any) {
    return {
      serverError: {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
    };
  }
};

export const forgotPasswordService = async (email: string) => {
  // Validate email
  const bodySchema = z.object({
    email: z.string().email(),
  });

  // Safe Parse for better error handling
  const bodyValidation = bodySchema.safeParse({ email });

  if (!bodyValidation.success) {
    return {
      error: schemaValidationError(
        bodyValidation.error,
        "Invalid request body"
      ),
    };
  }

  try {
    // Find the admin by email
    const admin = await Admin.findOne({
      email: bodyValidation.data.email,
    });

    if (!admin) {
      return {
        error: {
          msg: "admin not found with this email",
          fields: [
            {
              name: "email",
              message: "admin not found with this email",
            },
          ],
        },
      };
    }

    // Generate reset token
    const resetToken = admin.generateResetPasswordToken();

    // Save the reset token
    await admin.save();

    // Generate url
    const resetUrl = `${DOMAIN}/auth/reset-password/${resetToken}`;

    // Send Email to admin
    const mailOptions = {
      from: EMAIL_USER,
      to: email,
      subject: "Forgot password details",
      text: `Hello ${admin.name},\n\nClick the link below to reset your password:\n\n${resetUrl}\n\nIf you didn't request this, please ignore this email. this token will expire in 30 minutes. \n\nBest regards,\n${name}`,
    };

    // Send Email
    await transporter.sendMail(mailOptions);

    // Response
    return {
      success: {
        success: true,
        message: "Password reset link sent successfully.",
        token: resetToken,
      },
    };
  } catch (error: any) {
    return {
      serverError: {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
    };
  }
};

export const resetPasswordService = async ({
  password,
  resetToken,
}: {
  password: string;
  resetToken: string;
}) => {
  // Validate Body
  const bodySchema = z.object({
    password: z.string().min(8).max(20),
  });
  const tokenSchema = z.object({
    resetToken: z.string().refine((val) => val.length === 64, {
      message: "Invalid reset token format",
    }),
  });

  // Safe Parse for better error handling
  const bodyValidation = bodySchema.safeParse({ password });
  const tokenValidation = tokenSchema.safeParse({ resetToken });

  // Check if body is valid
  if (!bodyValidation.success) {
    return {
      error: schemaValidationError(
        bodyValidation.error,
        "Invalid request body"
      ),
    };
  }

  // Check if token is valid
  if (!tokenValidation.success) {
    return {
      error: {
        msg: "Token Validation error",
        fields: tokenValidation.error.issues.map((issue) => ({
          name: String(issue.path[0]),
          message: issue.message,
        })),
      },
    };
  }

  try {
    // Find the admin
    const admin = await Admin.findOne({
      resetPasswordToken: tokenValidation.data.resetToken,
      resetPasswordExpireDate: { $gt: Date.now() }, // Must be greater than the current time
    });

    if (!admin) {
      return {
        error: {
          msg: "Invalid or expired reset token",
        },
      };
    }

    // Update password
    admin.password = bodyValidation.data.password;

    // Clear reset fields
    admin.resetPasswordToken = null;
    admin.resetPasswordExpireDate = null;

    // Save
    await admin.save();

    // Response
    return {
      success: {
        success: true,
        message: "Password reset successfully",
      },
    };
  } catch (error: any) {
    return {
      serverError: {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
    };
  }
};

export const uploadSingleFile = async ({
  collection,
  filename,
  body,
  folder,
}: {
  collection: AdminDocument | CategoryDocument;
  filename: string;
  folder: string;
  body: {
    avatar: File;
  };
}) => {
  // Validate Body
  const avatarSchema = z.object({
    avatar: z
      .instanceof(File, { message: "Invalid file format" })
      .refine((file) => file.size <= 2 * 1024 * 1024, {
        // 2MB max
        message: "File size must be less than 2MB",
      })
      .refine(
        (file) =>
          ["image/jpeg", "image/png", "image/jpg", "image/webp"].includes(
            file.type
          ),
        {
          message: "Only JPEG, JPG, PNG and WEBP files are allowed",
        }
      ),
  });

  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_BUCKET_NAME) {
    return {
      error: {
        message:
          "AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY is missing in env variables",
      },
    };
  }

  // Get file from body
  const file = body["avatar"] as File;
  if (!file) {
    return {
      error: { message: "No file provided" },
    };
  }

  // Safe Parse for better error handling
  const fileValidation = avatarSchema.safeParse({ avatar: file });
  if (!fileValidation.success) {
    return {
      error: schemaValidationError(
        fileValidation.error,
        "Invalid request body"
      ),
    };
  }

  try {
    // Upload to S3
    const key = `uploads/${folder}/${filename}`;
    uploadAvatar({
      s3,
      file: fileValidation.data.avatar,
      key,
      fileType: fileValidation.data.avatar.type,
      bucketName: AWS_BUCKET_NAME,
    });

    // Generate signed URL
    // const url = await generateS3AccessKey({ filename, s3 });
    const url = `https://${AWS_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${key}`;

    // Update user with avatar
    collection.avatar = url;
    await collection.save();

    // Response
    return {
      success: {
        success: true,
        message: "Avatar updated successfully",
        data: url,
      },
    };
  } catch (error: any) {
    return {
      serverError: {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
    };
  }
};
