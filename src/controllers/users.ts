import { User } from "../models";
import { Context } from "hono";
import { decode, verify } from "hono/jwt";
import { setSignedCookie, getSignedCookie, deleteCookie } from "hono/cookie";
import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import {
  uploadAvatar,
  generateS3AccessKey,
  generateAccessToken,
  generateRefreshToken,
  pagination,
} from "./../lib";
import { defaults } from "../config/defaults";
import { stringGenerator } from "../../utils";
import nodemailer from "nodemailer";
import { z } from "zod";
import {
  badRequestHandler,
  conflictHandler,
  authenticationError,
  authorizationError,
} from "../middlewares";
import idSchema from "./utils";
import axios from "axios";

dotenv.config();

const AWS_BUCKET_NAME = (process.env.AWS_BUCKET_NAME as string) || "bucket";
const AWS_REGION = (process.env.AWS_REGION as string) || "us-east-1";
const AWS_ACCESS_KEY_ID =
  (process.env.AWS_ACCESS_KEY_ID as string) || "12345678";
const AWS_SECRET_ACCESS_KEY =
  (process.env.AWS_SECRET_ACCESS_KEY as string) || "12345678";

const JWT_REFRESH_SECRET =
  (process.env.JWT_REFRESH_SECRET as string) || "refresh";

// Initialize S3 Client
const s3 = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

// Get all users
const getUsers = async (c: Context) => {
  const page = parseInt(c.req.query("page") as string, 10) || defaults.page;
  const limit = parseInt(c.req.query("limit") as string, 10) || defaults.limit;
  const search = c.req.query("search") || defaults.search;
  const sortBy = c.req.query("sortBy") || defaults.sortBy;
  const sortType = c.req.query("sortType") || defaults.sortType;
  const role = c.req.query("role") || "";

  const querySchema = z.object({
    sortBy: z.enum(["createdAt", "updatedAt", "name", "email", ""]).optional(),
    sortType: z
      .enum(["asc", "desc"])
      .optional()
      .default(defaults.sortType as "asc" | "desc"),
    role: z.enum(["admin", "manager", "super_admin", ""]).optional(),
  });

  const queryValidation = querySchema.safeParse({
    sortBy,
    sortType,
    role,
  });

  if (!queryValidation.success) {
    return badRequestHandler(c, {
      msg: "Invalid query parameters",
      fields: queryValidation.error.issues.map((issue) => ({
        name: String(issue.path[0]),
        message: issue.message,
      })),
    });
  }

  try {
    const query: any = {};
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

    const validSortFields = ["createdAt", "updatedAt", "name", "email"];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "updatedAt";
    const sortDirection =
      queryValidation.data.sortType.toLocaleLowerCase() === "asc" ? 1 : -1;

    const users = await User.find(query)
      .sort({ [sortField]: sortDirection })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-password");

    const totalUsers = await User.countDocuments(query);

    return c.json(
      {
        success: true,
        message: "Users fetched successfully",
        data: users,
        pagination: pagination({
          page: page,
          limit: limit,
          total: totalUsers,
        }),
      },
      200
    );
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
      500
    );
  }
};

// Get Me
const getMe = async (c: Context) => {
  try {
    const me = c.get("user");

    // Check if user is authenticated
    if (!me) {
      return authenticationError(c);
    }

    const singedUrl = me?.avatar;

    if (singedUrl) {
      try {
        await axios.get(singedUrl, {
          headers: { Range: "bytes=0-0" },
        });
      } catch (error: any) {
        if (
          error.response &&
          (error.response.status === 403 || error.response.status === 404)
        ) {
          const url = new URL(singedUrl);
          const filename = url.pathname.substring(
            url.pathname.lastIndexOf("/") + 1
          );

          console.warn(
            `Signed URL expired or invalid. Regenerating for: ${filename}`
          );

          me.avatar = await generateS3AccessKey({ filename, s3 });
          await me.save();
        } else {
          console.error("Error checking signed URL:", error.message);
          throw error;
        }
      }
    }

    return c.json(
      {
        success: true,
        message: "User fetched successfully",
        data: me,
      },
      200
    );
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
      500
    );
  }
};

// Get Single User
const getSingleUser = async (c: Context) => {
  const id = c.req.param("id");

  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    console.log(idValidation.error);
    return badRequestHandler(c, {
      msg: String(idValidation.error.format()._errors[0]),
      fields: [
        {
          name: "id",
          message: String(idValidation.error.issues[0].message),
        },
      ],
    });
  }

  try {
    const user = await User.findById(idValidation.data.id).select("-password");

    if (!user) {
      return badRequestHandler(c, {
        msg: "User not fount with provided ID",
      });
    }

    return c.json(
      {
        success: true,
        message: "User fetched successfully",
        data: user,
      },
      200
    );
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
      500
    );
  }
};

// Update User
const updateUser = async (c: Context) => {
  const id = c.req.param("id");

  const body = await c.req.json();

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
  });

  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    console.log(idValidation.error);
    return badRequestHandler(c, {
      msg: String(idValidation.error.format()._errors[0]),
    });
  }

  // Validate Body
  const bodyValidation = bodySchema.safeParse(body);
  if (!bodyValidation.success) {
    console.log(bodyValidation.error);
    return badRequestHandler(c, {
      msg: "Validation error",
      fields: bodyValidation.error.issues.map((issue) => ({
        name: String(issue.path[0]),
        message: issue.message,
      })),
    });
  }

  try {
    const user = await User.findById(idValidation.data.id).select("-password");

    if (!user) {
      return badRequestHandler(c, {
        msg: "User not fount with the provided ID",
      });
    }

    if (Object.keys(bodyValidation.data).length === 0) {
      return c.json(
        {
          success: false,
          error: {
            message: "No updates provided, returning existing user",
            code: 400,
          },
          data: user,
        },
        400
      );
    }

    // Update only provided fields
    Object.assign(user, bodyValidation.data);
    const docs = await user.save();

    return c.json(
      {
        success: true,
        message: "User updated successfully",
        data: docs,
      },
      200
    );
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
      500
    );
  }
};

// Update profile
const updateProfile = async (c: Context) => {
  const user = c.get("user");

  if (!user) {
    return authenticationError(c);
  }

  const body = await c.req.json();

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
  });

  const bodyValidation = bodySchema.safeParse(body);
  if (!bodyValidation.success) {
    return badRequestHandler(c, {
      msg: "Validation error",
      fields: bodyValidation.error.issues.map((issue) => ({
        name: String(issue.path[0]),
        message: issue.message,
      })),
    });
  }

  try {
    if (Object.keys(bodyValidation.data).length === 0) {
      return c.json(
        {
          success: true,
          error: {
            message: "No updates provided, returning existing user",
            code: 400,
          },
          data: user,
        },
        400
      );
    }

    // Update only provided fields
    Object.assign(user, bodyValidation.data);

    const docs = await user.save();

    return c.json(
      {
        success: true,
        message: "User updated successfully",
        data: docs,
      },
      200
    );
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
      500
    );
  }
};

// Register User
const registerUser = async (c: Context) => {
  const body = await c.req.json();

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
  });

  // Safe Parse for better error handling
  const bodyValidation = bodySchema.safeParse(body);

  if (!bodyValidation.success) {
    return badRequestHandler(c, {
      msg: "Validation error",
      fields: bodyValidation.error.issues.map((issue) => ({
        name: String(issue.path[0]),
        message: issue.message,
      })),
    });
  }

  const { name, email, phone, address, NID, role } = bodyValidation.data;

  // Check if role is super admin
  if (role === "super_admin") {
    return badRequestHandler(c, {
      msg: "Super Admin cannot register a user",
      fields: [{ name: "role", message: "Super Admin cannot register a user" }],
    });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { NID }, { phone }],
    }).select("-password");

    if (existingUser) {
      return conflictHandler(c, {
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
      });
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
    });

    const docs = await user.save();

    // Send Email to User
    const transporter = nodemailer.createTransport({
      service: "gmail", // or your email provider
      auth: {
        user: process.env.EMAIL_USER, // Your email address
        pass: process.env.EMAIL_PASS, // Your email password key
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Account Details",
      text: `Hello ${name},\n\nYour account has been created successfully. Here are your login details:\n\nEmail: ${email}\nPassword: ${generatedPassword}\n\nPlease log in and change your password immediately for security.\n\nThank you!`,
    };

    await transporter.sendMail(mailOptions);

    return c.json(
      {
        message: "User registered successfully!",
        success: true,
        data: docs,
      },
      201
    );
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
      500
    );
  }
};

// Seed Admin User
const superAdmin = async (c: Context) => {
  try {
    const existingSuperAdmin = await User.findOne({ role: "super_admin" });

    if (existingSuperAdmin) {
      return badRequestHandler(c, {
        msg: "Super Admin already exists",
      });
    }

    const name = process.env.ADMIN_NAME;
    const email = process.env.ADMIN_EMAIL;
    const phone = process.env.ADMIN_PHONE;
    const password = process.env.ADMIN_PASSWORD;
    const NID = process.env.ADMIN_NID;

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

    const bodyValidation = bodySchema.safeParse({
      name,
      email,
      phone,
      password,
      NID,
    });

    if (!bodyValidation.success) {
      return badRequestHandler(c, {
        msg: "Validation error",
        fields: bodyValidation.error.issues.map((issue) => ({
          name: String(issue.path[0]),
          message: issue.message,
        })),
      });
    }

    const user = new User({
      name: bodyValidation.data.name,
      email: bodyValidation.data.email,
      phone: bodyValidation.data.phone,
      password: bodyValidation.data.password,
      NID: bodyValidation.data.NID,
      role: "super_admin",
    });

    const docs = await user.save();

    return c.json(
      {
        message: "Super Admin created successfully!",
        success: true,
        data: docs,
      },
      201
    );
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
      500
    );
  }
};

// Login User
const loginUser = async (c: Context) => {
  try {
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

    const body = await c.req.json();

    // Safe Parse for better error handling
    const bodyValidation = bodyScheme.safeParse(body);

    if (!bodyValidation.success) {
      return badRequestHandler(c, {
        msg: "Validation error",
        fields: bodyValidation.error.issues.map((issue) => ({
          name: String(issue.path[0]),
          message: issue.message,
        })),
      });
    }

    const { email, phone, password } = bodyValidation.data;

    // Check if user exists
    const user = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (!user) {
      return badRequestHandler(c, {
        msg: "Invalid credentials",
        fields: [
          {
            name: "email",
            message: "User not found with this email or phone",
          },
        ],
      });
    }

    // Validate password
    if (!(await user.matchPassword(password))) {
      return badRequestHandler(c, {
        msg: "Invalid credentials",
        fields: [
          {
            name: "password",
            message: "Password is incorrect",
          },
        ],
      });
    }

    // Generate access token
    const accessToken = await generateAccessToken({ user });

    // Generate refresh token
    const refreshToken = await generateRefreshToken({ user });

    // Refresh token setting on the cookie
    await setSignedCookie(c, "refreshToken", refreshToken, JWT_REFRESH_SECRET, {
      path: "/",
      secure: process.env.NODE_ENV === "production",
      // Remove or set to your specific subdomain
      domain:
        process.env.NODE_ENV === "production"
          ? "example.vercel.app"
          : undefined,
      httpOnly: true,
      // Set the cookie to expire in 7 days
      maxAge: 60 * 60 * 24 * 7,
      expires: new Date(Date.now() + 60 * 60 * 24 * 7),
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Strict",
    });

    // Refresh token store in database
    user.refresh = refreshToken;
    await user.save();

    return c.json(
      {
        success: true,
        message: "Login successful",
        tokens: {
          accessToken,
          refreshToken,
        },
      },
      200
    );
  } catch (error: any) {
    console.log(error);
    return c.json(
      {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
      500
    );
  }
};

// Refresh Token
const refreshToken = async (c: Context) => {
  try {
    const refreshToken = await getSignedCookie(
      c,
      JWT_REFRESH_SECRET,
      "refreshToken"
    );

    if (!refreshToken) {
      return authenticationError(c);
    }

    const token = await verify(refreshToken, JWT_REFRESH_SECRET);

    if (!token) {
      return authenticationError(c);
    }

    const user = await User.findOne({ refresh: refreshToken });

    if (!user) {
      return authorizationError(c, "Forbidden");
    }

    const accessToken = await generateAccessToken({ user });

    return c.json(
      {
        success: true,
        message: "Token refreshed",
        tokens: {
          accessToken,
        },
      },
      200
    );
  } catch (error: any) {
    if (error.name === "JwtTokenExpired") {
      return authorizationError(
        c,
        "Refresh token expired. Please login again."
      );
    }

    return c.json(
      {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
      500
    );
  }
};

// Logout User
const logout = async (c: Context) => {
  try {
    // Clear cookie using Hono's deleteCookie
    const refreshToken = deleteCookie(c, "refreshToken", {
      path: "/",
      secure: process.env.NODE_ENV === "production",
      domain:
        process.env.NODE_ENV === "production"
          ? "hono-nextjs-tau-ebon.vercel.app"
          : undefined,
    });

    if (!refreshToken) {
      return authenticationError(c);
    }

    const { payload } = decode(refreshToken as string) as any;

    if (!payload) {
      return authenticationError(c, "Invalid refresh token on the cookie");
    }

    const user = await User.updateOne({ _id: payload.id }, { refresh: "" });

    if (!user) {
      return authenticationError(c);
    }

    return c.json(
      {
        success: true,
        message: "Logout successful",
      },
      200
    );
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
      500
    );
  }
};

// Change Password
const changePassword = async (c: Context) => {
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

  const body = await c.req.json();

  // Safe Parse for better error handling
  const bodyValidation = bodySchema.safeParse(body);

  if (!bodyValidation.success) {
    return badRequestHandler(c, {
      msg: "Validation error",
      fields: bodyValidation.error.issues.map((issue) => ({
        name: String(issue.path[0]),
        message: issue.message,
      })),
    });
  }

  const { currentPassword, newPassword } = bodyValidation.data;

  try {
    const { email } = c.get("user");

    const user = await User.findOne({ email });

    if (!user) {
      return authenticationError(c);
    }

    // Validate password
    if (!(await user.matchPassword(currentPassword))) {
      return badRequestHandler(c, {
        msg: "Current password is incorrect",
        fields: [
          {
            name: "currentPassword",
            message: "Current Password is incorrect",
          },
        ],
      });
    }

    user.password = newPassword;
    await user.save();

    return c.json(
      {
        success: true,
        message: "Password changed successfully",
      },
      200
    );
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
      500
    );
  }
};

// Delete User
const deleteUser = async (c: Context) => {
  const id = c.req.param("id");

  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return badRequestHandler(c, {
      msg: String(idValidation.error.issues[0].message),
    });
  }

  try {
    const user = await User.findById(idValidation.data.id);

    if (!user) {
      return badRequestHandler(c, {
        msg: "User not found with the provided ID",
      });
    }

    await user.deleteOne();
    return c.json(
      {
        success: true,
        message: "User deleted successfully",
      },
      200
    );
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
      500
    );
  }
};

// Forgot Password
const forgotPassword = async (c: Context) => {
  const bodySchema = z.string().email();

  const { email } = await c.req.json();

  // Safe Parse for better error handling
  const bodyValidation = bodySchema.safeParse(email);

  if (!bodyValidation.success) {
    return badRequestHandler(c, {
      msg: "Validation error",
      fields: bodyValidation.error.issues.map((issue) => ({
        name: String(issue.path[0]),
        message: issue.message,
      })),
    });
  }

  try {
    // Find the user by email
    const user = await User.findOne({
      email: bodyValidation.data,
    });
    if (!user) {
      return badRequestHandler(c, {
        msg: "User not found with this email",
        fields: [
          {
            name: "email",
            message: "User not found with this email",
          },
        ],
      });
    }

    // Generate reset token
    const resetToken = user.generateResetPasswordToken();

    // Save the reset token
    await user.save();

    return c.json(
      {
        success: true,
        message: "Password reset successfully.",
        token: resetToken,
      },
      201
    );
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
      500
    );
  }
};

// Reset Password
const resetPassword = async (c: Context) => {
  const bodySchema = z.object({
    password: z.string().min(8).max(20),
  });
  const tokenSchema = z.object({
    resetToken: z.string().refine((val) => val.length === 64, {
      message: "Invalid reset token format",
    }),
  });

  // Token come from param
  const resetToken = c.req.param("resetToken");

  // Password come from body
  const { password } = await c.req.json();

  // Safe Parse for better error handling
  const bodyValidation = bodySchema.safeParse({ password });
  const tokenValidation = tokenSchema.safeParse({ resetToken });

  if (!bodyValidation.success) {
    return badRequestHandler(c, {
      msg: "Body Validation error",
      fields: bodyValidation.error.issues.map((issue) => ({
        name: String(issue.path[0]),
        message: issue.message,
      })),
    });
  }
  if (!tokenValidation.success) {
    return badRequestHandler(c, {
      msg: "Token Validation error",
      fields: tokenValidation.error.issues.map((issue) => ({
        name: String(issue.path[0]),
        message: issue.message,
      })),
    });
  }

  try {
    const user = await User.findOne({
      resetPasswordToken: tokenValidation.data.resetToken,
      resetPasswordExpireDate: { $gt: Date.now() }, // Must be greater than the current time
    });

    if (!user) {
      return badRequestHandler(c, {
        msg: "Invalid or expired reset token",
      });
    }

    user.password = bodyValidation.data.password;

    // Clear reset fields
    user.resetPasswordToken = null;
    user.resetPasswordExpireDate = null;

    await user.save();

    return c.json(
      {
        success: true,
        message: "Password reset successfully",
      },
      200
    );
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
      500
    );
  }
};

// Change Avatar
const changeAvatar = async (c: Context) => {
  const body = await c.req.parseBody();

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
    return badRequestHandler(c, {
      msg: "AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY is missing in env variables",
    });
  }

  const file = body["avatar"] as File;
  if (!file) {
    return badRequestHandler(c, { msg: "No file provided" });
  }

  const fileValidation = avatarSchema.safeParse({ avatar: file });
  if (!fileValidation.success) {
    return badRequestHandler(c, {
      msg: "Validation error",
      fields: [
        {
          name: "avatar",
          message: fileValidation.error.issues[0].message,
        },
      ],
    });
  }

  const user = c.get("user");
  if (!user) {
    return authenticationError(c);
  }

  const fileN = c.req.query("filename") || "avatar";
  const filename = `${fileN}-${Date.now()}.jpeg`;

  try {
    uploadAvatar({
      s3,
      file,
      filename,
      fileType: file.type,
      folder: "avatars",
      bucketName: AWS_BUCKET_NAME,
    });

    const url = await generateS3AccessKey({ filename, s3 });

    user.avatar = url;
    await user.save();

    return c.json(
      { success: true, message: "Avatar updated successfully" },
      200
    );
  } catch (error: any) {
    return c.json(
      {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
      500
    );
  }
};

export {
  getUsers,
  getMe,
  updateProfile,
  getSingleUser,
  updateUser,
  registerUser,
  loginUser,
  changePassword,
  deleteUser,
  forgotPassword,
  resetPassword,
  superAdmin,
  changeAvatar,
  refreshToken,
  logout,
};
