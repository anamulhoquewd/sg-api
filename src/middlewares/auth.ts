import { Context, Next } from "hono";
import { authenticationError, authorizationError } from "./errors";
import { verify } from "hono/jwt";
import { Admin } from "../models";
import { config } from "dotenv";
config();

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as string;

// 🔹 Check if admin is authenticated
export const protect = async (c: Context, next: Next) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return authenticationError(c);
  }

  try {
    const { id } = await verify(token, JWT_ACCESS_SECRET);

    const admin = await Admin.findById(id).select("-password -refresh");

    if (!admin) {
      return authenticationError(c);
    }

    c.set("admin", admin);
    return next();
  } catch (error) {
    return authenticationError(c);
  }
};

// 🔹 Check if this admin is admin or not
export const authorize = () => async (c: Context, next: Next) => {
  const admin = c.get("admin");
  if (!admin) {
    return authenticationError(c);
  }

  if (admin.role === "super_admin") {
    return next();
  }

  return authorizationError(c);
};
