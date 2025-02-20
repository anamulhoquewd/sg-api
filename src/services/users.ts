import { z } from "zod";
import { stringGenerator } from "../../utils";
import { User } from "../models";
import nodemailer from "nodemailer";
import { defaults } from "../config/defaults";
import {
  generateAccessToken,
  generateRefreshToken,
  generateS3AccessKey,
  pagination,
  uploadAvatar,
} from "../lib";
import idSchema from "../controllers/utils";
import { s3 } from "./../config/S3";
import { schemaValidationError } from "./utile";

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
const NID = process.env.ADMIN_NID;

// Get environment variables
const AWS_BUCKET_NAME = (process.env.AWS_BUCKET_NAME as string) || "bucket";
const AWS_ACCESS_KEY_ID =
  (process.env.AWS_ACCESS_KEY_ID as string) || "12345678";
const AWS_SECRET_ACCESS_KEY =
  (process.env.AWS_SECRET_ACCESS_KEY as string) || "12345678";

// Create Email Transporter config
const transporter = nodemailer.createTransport({
  service: "gmail", // or your email provider
  auth: {
    user: EMAIL_USER, // Your email address
    pass: EMAIL_PASS, // Your email password key
  },
});

export const getUsersService = async (queryParams: {
  page: number;
  limit: number;
  search: string;
  sortBy: string;
  sortType: string;
  role: string;
  active: boolean;
}) => {
  const { page, limit, search, sortBy, sortType, role, active } = queryParams;

  // Validate query parameters
  const querySchema = z.object({
    sortBy: z.enum(["createdAt", "updatedAt", "name", "email", ""]).optional(),
    sortType: z
      .enum(["asc", "desc"])
      .optional()
      .default(defaults.sortType as "asc" | "desc"),
    role: z.enum(["admin", "manager", "super_admin", ""]).optional(),
    active: z.boolean().optional(),
  });

  // Safe Parse for better error handling
  const queryValidation = querySchema.safeParse({
    sortBy,
    sortType,
    role,
    active,
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
    const query: any = {
      active,
    };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { NID: { $regex: search, $options: "i" } },
      ];
    }
    if (queryValidation.data.role) {
      query.role = queryValidation.data.role;
    }

    // Allowable sort fields
    const validSortFields = ["createdAt", "updatedAt", "name", "email"];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "updatedAt";
    const sortDirection =
      queryValidation.data.sortType.toLocaleLowerCase() === "asc" ? 1 : -1;

    // Fetch users
    const users = await User.find(query)
      .sort({ [sortField]: sortDirection })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-password");

    // Count total users
    const totalUsers = await User.countDocuments(query);

    // Pagination
    const getPagination = pagination({
      page: page,
      limit: limit,
      total: totalUsers,
    });

    return {
      success: {
        success: true,
        message: "Users fetched successfully",
        data: users,
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

export const registerUserService = async (body: {
  name: string;
  email: string;
  phone: string;
  address: string;
  NID: string;
  role: "admin" | "manager";
  active: boolean;
}) => {
  // Validate Body
  const bodySchema = z.object({
    name: z.string().min(3).max(50),
    email: z.string().email(),
    phone: z
      .string()
      .regex(
        /^01\d{9}$/,
        "Phone number must start with 01 and be exactly 11 digits"
      ),
    address: z
      .string()
      .max(100, "Address must be less than 100 characters long"),
    NID: z
      .string()
      .regex(/^\d{10}$|^\d{17}$/, "NID must be either 10 or 17 digits"),
    role: z.enum(["admin", "manager", "super_admin"]),
    active: z.boolean().default(true),
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
  const { name, email, phone, address, NID, role, active } =
    bodyValidation.data;

  // Check if role is super admin
  if (role === "super_admin") {
    return {
      error: {
        msg: "Super Admin cannot register a user",
        fields: [
          { name: "role", message: "Super Admin cannot register a user" },
        ],
      },
    };
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { NID }, { phone }],
    }).select("-password");

    if (existingUser) {
      return {
        error: {
          msg: "User already exists",
          fields: [
            {
              name: "email",
              message: "Email must be unique",
            },
            {
              name: "NID",
              message: "NID must be unique",
            },
            {
              name: "phone",
              message: "Phone must be unique",
            },
          ],
        },
      };
    }

    // Generate Password
    const generatedPassword = stringGenerator(8);

    // Create User
    const user = new User({
      name,
      email,
      phone,
      password: generatedPassword,
      address,
      NID,
      role,
      active,
    });

    // Save User
    const docs = await user.save();

    // Send Email to User
    const mailOptions = {
      from: EMAIL_USER,
      to: email,
      subject: "Your Account Details",
      text: `Hello ${name},\n\nYour account has been created successfully. Here are your login details:\n\nEmail: ${email}\nPassword: ${generatedPassword}\n\nPlease log in and change your password immediately for security.\n\nThank you!`,
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

export const getSingleUserService = async (id: string) => {
  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return { error: schemaValidationError(idValidation.error, "Invalid ID") };
  }

  try {
    // Check if user exists
    const user = await User.findById(idValidation.data.id).select("-password");

    if (!user) {
      return {
        error: {
          msg: "User not found with provided ID",
        },
      };
    }

    return {
      success: {
        success: true,
        message: "User fetched successfully",
        data: user,
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

export const updateUserService = async ({
  id,
  body,
}: {
  id: string;
  body: {
    active: boolean;
    name: string;
    email: string;
    phone: string;
    NID: string;
    address: string;
    salaryStatus:
      | "pending"
      | "paid"
      | "partially_paid"
      | "on_hold"
      | "rejected";
    role: "admin" | "manager";
  };
}) => {
  // Validate Body
  const bodySchema = z.object({
    name: z.string().min(3).max(50).optional(),
    email: z.string().email().optional(),
    phone: z
      .string()
      .regex(
        /^01\d{9}$/,
        "Phone number must start with 01 and be exactly 11 digits"
      )
      .optional(),
    NID: z
      .string()
      .regex(/^\d{10}$|^\d{17}$/, "NID must be either 10 or 17 digits")
      .optional(),
    address: z.string().max(100).optional(),
    salaryStatus: z
      .enum(["pending", "paid", "partially_paid", "on_hold", "rejected"])
      .optional(),
    role: z.enum(["admin", "manager", "super_admin"]).optional(),
    active: z.boolean().optional(),
  });

  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    console.log(idValidation.error);
    return { error: schemaValidationError(idValidation.error, "Invalid ID") };
  }

  // Validate Body
  const bodyValidation = bodySchema.safeParse(body);
  if (!bodyValidation.success) {
    console.log(bodyValidation.error);
    return {
      error: schemaValidationError(
        bodyValidation.error,
        "Invalid request body"
      ),
    };
  }

  try {
    // Check if user exists
    const user = await User.findById(idValidation.data.id).select("-password");

    if (!user) {
      return {
        error: {
          msg: "User not fount with the provided ID",
        },
      };
    }

    // Check if all fields are empty
    if (Object.keys(bodyValidation.data).length === 0) {
      return {
        success: {
          success: true,
          message: "No updates provided, returning existing user",

          data: user,
        },
      };
    }

    // Update only provided fields
    Object.assign(user, bodyValidation.data);
    const docs = await user.save();

    return {
      success: {
        success: true,
        message: "User updated successfully",
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

export const updateProfileService = async ({
  user,
  body,
}: {
  user: any;
  body: {
    name: string;
    email: string;
    phone: string;
    address: string;
    active: boolean;
  };
}) => {
  // Validate Body
  const bodySchema = z.object({
    name: z.string().min(3).max(50).optional(),
    email: z.string().email().optional(),
    phone: z
      .string()
      .regex(
        /^01\d{9}$/,
        "Phone number must start with 01 and be exactly 11 digits"
      )
      .optional(),
    address: z.string().max(100).optional(),
    active: z.boolean().optional(),
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
          message: "No updates provided, returning existing user",
          data: user,
        },
      };
    }

    // Update only provided fields
    Object.assign(user, bodyValidation.data);

    const docs = await user.save();

    return {
      success: {
        success: true,
        message: "User updated successfully",
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
    const existingSuperAdmin = await User.findOne({ role: "super_admin" });

    if (existingSuperAdmin) {
      return {
        error: {
          msg: "Super Admin already exists",
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
      NID: z
        .string()
        .regex(/^\d{10}$|^\d{17}$/, "NID must be either 10 or 17 digits"),
    });

    // Safe Parse for better error handling
    const bodyValidation = bodySchema.safeParse({
      name,
      email,
      phone,
      password,
      NID,
    });

    if (!bodyValidation.success) {
      return {
        error: schemaValidationError(
          bodyValidation.error,
          "Invalid request body"
        ),
      };
    }

    // Create Super Admin
    const user = new User({
      name: bodyValidation.data.name,
      email: bodyValidation.data.email,
      phone: bodyValidation.data.phone,
      password: bodyValidation.data.password,
      NID: bodyValidation.data.NID,
      role: "super_admin",
    });

    // Save Super Admin
    const docs = await user.save();

    // Response
    return {
      success: {
        message: "Super Admin created successfully!",
        success: true,
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
    // Check if user exists
    const user = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (!user) {
      return {
        error: {
          msg: "Invalid credentials",
          fields: [
            {
              name: "email",
              message: "User not found with this email or phone",
            },
          ],
        },
      };
    }

    // Validate password
    if (!(await user.matchPassword(password))) {
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
    const accessToken = await generateAccessToken({ user });

    // Generate refresh token
    const refreshToken = await generateRefreshToken({ user });

    // Refresh token store in database
    user.refresh = refreshToken;
    await user.save();

    // Response
    return {
      success: {
        success: true,
        message: "Login successful",
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
  user,
  body,
}: {
  user: any;
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
    if (!(await user.matchPassword(currentPassword))) {
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
    user.password = newPassword;
    await user.save();

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

export const deleteUserService = async (id: string) => {
  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return { error: schemaValidationError(idValidation.error, "Invalid ID") };
  }

  try {
    // Delete user
    const user = await User.findById(idValidation.data.id);

    if (!user) {
      return {
        error: {
          msg: "User not found with the provided ID",
        },
      };
    }

    // Delete user
    await user.deleteOne();

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
  const bodySchema = z.string().email();

  // Safe Parse for better error handling
  const bodyValidation = bodySchema.safeParse(email);

  if (!bodyValidation.success) {
    return {
      error: schemaValidationError(
        bodyValidation.error,
        "Invalid request body"
      ),
    };
  }

  try {
    // Find the user by email
    const user = await User.findOne({
      email: bodyValidation.data,
    });

    if (!user) {
      return {
        error: {
          msg: "User not found with this email",
          fields: [
            {
              name: "email",
              message: "User not found with this email",
            },
          ],
        },
      };
    }

    // Generate reset token
    const resetToken = user.generateResetPasswordToken();

    // Save the reset token
    await user.save();

    // Response
    return {
      success: {
        success: true,
        message: "Password reset successfully.",
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
    // Find the user
    const user = await User.findOne({
      resetPasswordToken: tokenValidation.data.resetToken,
      resetPasswordExpireDate: { $gt: Date.now() }, // Must be greater than the current time
    });

    if (!user) {
      return {
        error: {
          msg: "Invalid or expired reset token",
        },
      };
    }

    // Update password
    user.password = bodyValidation.data.password;

    // Clear reset fields
    user.resetPasswordToken = null;
    user.resetPasswordExpireDate = null;

    // Save
    await user.save();

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

export const changeAvatarService = async ({
  user,
  filename,
  body,
}: {
  user: any;
  filename: string;
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
      .refine((file) => ["image/jpeg", "image/png"].includes(file.type), {
        message: "Only JPEG and PNG files are allowed",
      }),
  });

  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_BUCKET_NAME) {
    return {
      error: {
        msg: "AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY is missing in env variables",
      },
    };
  }

  // Get file from body
  const file = body["avatar"] as File;
  if (!file) {
    return {
      error: { msg: "No file provided" },
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
    uploadAvatar({
      s3,
      file,
      filename,
      fileType: file.type,
      folder: "avatars",
      bucketName: AWS_BUCKET_NAME,
    });

    // Generate signed URL
    const url = await generateS3AccessKey({ filename, s3 });

    // Update user with avatar
    user.avatar = url;
    await user.save();

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
