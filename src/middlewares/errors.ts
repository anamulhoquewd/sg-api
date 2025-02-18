import type { Context } from "hono";

// Global Error Handler
export const errorHandler = (err: Error, c: Context) => {
  console.error(err);
  return c.json(
    {
      success: false,
      message: err.message,
      stack: process.env.NODE_ENV === "production" ? null : err.stack,
    },
    500
  );
};

// Bad Request Handler
export const badRequestHandler = (
  c: Context,
  {
    msg = "Bad Request",
    fields = [],
  }: { msg?: string; fields?: Array<{ name: string; message: string }> }
) => {
  return c.json(
    {
      success: false,
      error: {
        message: msg,
        code: 400,
      },
      fields: fields.length > 0 ? fields : null,
    },
    400
  );
};

// Conflict Error Handler
export const conflictHandler = (
  c: Context,
  {
    msg = "Conflict",
    fields = [],
  }: { msg?: string; fields?: Array<{ name: string; message: string }> }
) => {
  return c.json(
    {
      success: false,
      error: {
        message: msg,
        code: 409,
      },
      fields,
    },
    409
  );
};

// Not Found Handler
export const notFound = (c: Context) => {
  return c.json(
    {
      success: false,
      message: `Not Found - [${c.req.method}] ${c.req.url}`,
    },
    404
  );
};

// Authentication Error Handler
export const authenticationError = (
  c: Context,
  msg = "Authentication Failed"
) => {
  return c.json(
    {
      success: false,
      error: {
        message: msg,
        code: 401,
      },
    },
    401
  );
};

// Authorization Error Handler
export const authorizationError = (c: Context, msg = "Permission Denied") => {
  return c.json(
    {
      success: false,
      error: {
        message: msg,
        code: 403,
      },
    },
    403
  );
};
