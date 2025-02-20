import { User } from "../models";
import { Context } from "hono";
import { decode, verify } from "hono/jwt";
import { setSignedCookie, getSignedCookie, deleteCookie } from "hono/cookie";
import dotenv from "dotenv";
import { generateAccessToken } from "./../lib";
import { defaults } from "../config/defaults";
import {
  badRequestHandler,
  authenticationError,
  authorizationError,
  serverErrorHandler,
} from "../middlewares";
import axios from "axios";
import {
  changeAvatarService,
  changePasswordService,
  deleteUserService,
  forgotPasswordService,
  getSingleUserService,
  getUsersService,
  loginService,
  reGenerateS3AccessKey,
  registerUserService,
  resetPasswordService,
  superAdminService,
  updateProfileService,
  updateUserService,
} from "../services";

dotenv.config();

const JWT_REFRESH_SECRET =
  (process.env.JWT_REFRESH_SECRET as string) || "refresh";

// 🔹 Get all users
const getUsers = async (c: Context) => {
  const page = parseInt(c.req.query("page") as string, 10) || defaults.page;
  const limit = parseInt(c.req.query("limit") as string, 10) || defaults.limit;
  const search = c.req.query("search") || defaults.search;
  const sortBy = c.req.query("sortBy") || defaults.sortBy;
  const sortType = c.req.query("sortType") || defaults.sortType;
  const role = c.req.query("role") || "";

  const response = await getUsersService({
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

// 🔹 Get Me
const getMe = async (c: Context) => {
  try {
    // Get user from auth token
    const me = c.get("user");

    // Check if user is authenticated
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

// 🔹 Get Single User
const getSingleUser = async (c: Context) => {
  const id = c.req.param("id");

  const response = await getSingleUserService(id);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// 🔹 Update User
const updateUser = async (c: Context) => {
  const id = c.req.param("id");

  const body = await c.req.json();

  const response = await updateUserService({ id, body });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// Update profile
const updateProfile = async (c: Context) => {
  // Get user from auth token
  const user = c.get("user");

  if (!user) {
    return authenticationError(c);
  }

  const body = await c.req.json();

  const response = await updateProfileService({ user, body });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// 🔹 Register User
const registerUser = async (c: Context) => {
  const body = await c.req.json();

  const response = await registerUserService(body);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 201);
};

// 🔹 Seed Admin User
const superAdmin = async (c: Context) => {
  const response = await superAdminService();

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 201);
};

// 🔹 Login User
const loginUser = async (c: Context) => {
  const body = await c.req.json();

  const response = await loginService(body);

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
    }
  );

  return c.json(response.success, 200);
};

// 🔹 Refresh Token
const refreshToken = async (c: Context) => {
  try {
    // Get refresh token from cookie
    const refreshToken = await getSignedCookie(
      c,
      JWT_REFRESH_SECRET,
      "refreshToken"
    );

    if (!refreshToken) {
      return authenticationError(c);
    }

    // Verify refresh token
    const token = await verify(refreshToken, JWT_REFRESH_SECRET);

    if (!token) {
      return authenticationError(c);
    }

    // Check if refresh token is valid
    const user = await User.findOne({ refresh: refreshToken });

    if (!user) {
      return authorizationError(c, "Forbidden");
    }

    // Generate new access token
    const accessToken = await generateAccessToken({ user });

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

// 🔹 Logout User
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

    // Remove refresh token from database
    const user = await User.updateOne({ _id: payload.id }, { refresh: "" });

    if (!user) {
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
  const body = await c.req.json();

  // Check if user exists. and get email from token
  const { email } = c.get("user");

  const user = await User.findOne({ email });

  if (!user) {
    return authenticationError(c);
  }

  const response = await changePasswordService({ user, body });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// 🔹 Delete User
const deleteUser = async (c: Context) => {
  const id = c.req.param("id");

  const response = await deleteUserService(id);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// 🔹 Forgot Password
const forgotPassword = async (c: Context) => {
  const { email } = await c.req.json();

  const response = await forgotPasswordService(email);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// 🔹 Reset Password
const resetPassword = async (c: Context) => {
  // Token come from param
  const resetToken = c.req.param("resetToken");

  // Password come from body
  const { password } = await c.req.json();

  const response = await resetPasswordService({ password, resetToken });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// 🔹 Change Avatar
const changeAvatar = async (c: Context) => {
  const body = await c.req.parseBody();
  const file = body["avatar"] as File;

  // Get user from auth token
  const user = c.get("user");
  if (!user) {
    return authenticationError(c);
  }

  // Generate filename
  const fileN = c.req.query("filename") || "avatar";
  const filename = `${fileN}-${Date.now()}.jpeg`;

  const response = await changeAvatarService({
    body: { avatar: file },
    filename,
    user,
  });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
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
