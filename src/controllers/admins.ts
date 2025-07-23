import { Admin } from "../models";
import { Context } from "hono";
import { decode, verify } from "hono/jwt";
import { setSignedCookie, getSignedCookie, deleteCookie } from "hono/cookie";
import { config } from "dotenv";
import { generateAccessToken } from "../lib";
import { defaults } from "../config/defaults";
import {
  badRequestHandler,
  authenticationError,
  authorizationError,
  serverErrorHandler,
} from "../middlewares";
import axios from "axios";
import { adminsService } from "../services";
import { reGenerateS3AccessKey } from "../services/s3";
config();

const JWT_REFRESH_SECRET =
  (process.env.JWT_REFRESH_SECRET as string) || "refresh";

// Get all admins
export const getAdmins = async (c: Context) => {
  const page = parseInt(c.req.query("page") as string, 10) || defaults.page;
  const limit = parseInt(c.req.query("limit") as string, 10) || defaults.limit;
  const search = c.req.query("search") || defaults.search;
  const sortBy = c.req.query("sortBy") || defaults.sortBy;
  const sortType = c.req.query("sortType") || defaults.sortType;
  const role = c.req.query("role") || "";

  const response = await adminsService.getAdminsService({
    page,
    limit,
    search,
    sortBy,
    sortType,
    role,
  });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// Get Me
export const getMe = async (c: Context) => {
  try {
    // Get admin from auth token
    const me = c.get("admin");

    // Check if admin is authenticated
    if (!me) {
      return authenticationError(c);
    }

    // Check if avatar is exist
    const avatarUrl = me?.avatar;

    if (avatarUrl) {
      try {
        // Check if signed URL is valid
        await axios.get(avatarUrl, {
          headers: { Range: "bytes=0-0" },
        });
      } catch (error: any) {
        if (
          error.response &&
          (error.response.status === 403 || error.response.status === 404)
        ) {
          // Generate new signed avatarURL and save
          me.avatar = await reGenerateS3AccessKey(avatarUrl);
          await me.save();
        } else {
          console.error("Error checking signed URL:", error.message);
          throw error;
        }
      }
    }

    // Response
    return c.json(
      {
        success: true,
        message: "Admin fetched successfully",
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

// Get Single admin
export const getSingleAdmin = async (c: Context) => {
  const id = c.req.param("id");

  const response = await adminsService.getSingleAdminService(id);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// Update profile
export const updateMe = async (c: Context) => {
  // Get admin from auth token
  const admin = c.get("admin");

  if (!admin) {
    return authenticationError(c);
  }

  const body = await c.req.json();

  const response = await adminsService.updateMeService({ admin, body });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// Register admin
export const registerAdmin = async (c: Context) => {
  const body = await c.req.json();

  const response = await adminsService.registerAdminService(body);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 201);
};

// Login admin
export const loginAdmin = async (c: Context) => {
  const body = await c.req.json();

  const response = await adminsService.loginService(body);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  // Refresh token setting on the cookie
  await setSignedCookie(
    c,
    "refreshToken",
    response.success.tokens.refreshToken,
    JWT_REFRESH_SECRET,
    {
      path: "/",
      secure: process.env.NODE_ENV === "production",
      domain: process.env.NODE_ENV === "production" ? "vercel.com" : undefined,
      httpOnly: true,
      // Set the cookie to expire in 7 days
      maxAge: 60 * 60 * 24 * 7,
      expires: new Date(Date.now() + 60 * 60 * 24 * 7),
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    }
  );

  return c.json(response.success, 200);
};

// Refresh Token
export const refreshToken = async (c: Context) => {
  try {
    // Get refresh token from cookie
    const rToken = await getSignedCookie(c, JWT_REFRESH_SECRET, "refreshToken");

    if (!rToken) {
      return authenticationError(c);
    }

    // Verify refresh token
    const token = await verify(rToken, JWT_REFRESH_SECRET);

    if (!token) {
      return authenticationError(c);
    }

    // Check if refresh token is valid
    const admin = await Admin.findOne({ refresh: rToken });

    if (!admin) {
      return authorizationError(c, "Forbidden");
    }

    // Generate new access token
    const accessToken = await generateAccessToken({ admin });

    // Response
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

// Logout admin
export const logout = async (c: Context) => {
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

    // Remove refresh token from database
    const admin = await Admin.updateOne({ _id: payload.id }, { refresh: "" });

    if (!admin) {
      return authenticationError(c);
    }

    // Response
    return c.json(
      {
        success: true,
        message: "Logout successful",
      },
      200
    );
  } catch (error: any) {
    console.log("Error :", error);
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
export const changePassword = async (c: Context) => {
  const body = await c.req.json();

  // Check if admin exists. and get email from token
  const { email } = c.get("admin");

  const admin = await Admin.findOne({ email });

  if (!admin) {
    return authenticationError(c);
  }

  const response = await adminsService.changePasswordService({ admin, body });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// Delete admin
export const deleteAdmin = async (c: Context) => {
  const id = c.req.param("id");

  const response = await adminsService.deleteAdminService(id);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// Forgot Password
export const forgotPassword = async (c: Context) => {
  const { email } = await c.req.json();

  const response = await adminsService.forgotPasswordService(email);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// Reset Password
export const resetPassword = async (c: Context) => {
  // Token come from param
  const resetToken = c.req.param("resetToken");

  // Password come from body
  const { password } = await c.req.json();

  const response = await adminsService.resetPasswordService({
    password,
    resetToken,
  });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// Change Admin Avatar
export const changeAvatar = async (c: Context) => {
  const body = await c.req.parseBody();
  const file = body["avatar"] as File;

  // Get admin from auth token
  const admin = c.get("admin");
  if (!admin) {
    return authenticationError(c);
  }

  // Generate filename
  const fileN = c.req.query("filename") || "avatar";
  const filename = `${fileN}-${Date.now()}.webp`;

  const response = await adminsService.uploadSingleFile({
    body: { avatar: file },
    filename,
    collection: admin,
    folder: "avatars",
  });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};
