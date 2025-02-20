import { Context, Next } from "hono";
import { authenticationError, authorizationError } from "./errors";
import { verify } from "hono/jwt";
import { User } from "../models";

import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET as string;

// 🔹 Check if user is authenticated
export const protect = async (c: Context, next: Next) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return authenticationError(c);
  }

  try {
    const { id } = await verify(token, JWT_SECRET);
    const user = await User.findById(id).select("-password -refresh");
    if (!user) {
      return authenticationError(c);
    }
    c.set("user", user);
    return next();
  } catch (error) {
    return authenticationError(c);
  }
};

// 🔹 Check if this user is admin or not
export const authorize =
  (roles: Array<"admin" | "manager" | "super_admin"> = ["super_admin"]) =>
  async (c: Context, next: Next) => {
    const user = c.get("user");
    if (!user) {
      return authenticationError(c);
    }

    if (user.role === "super_admin") {
      return next();
    }

    if (roles.includes(user.role)) {
      return next();
    }

    return authorizationError(c);
  };
