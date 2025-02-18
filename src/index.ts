import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { config } from "dotenv";
import { connectDB } from "./config/db";
import { cors } from "hono/cors";
import { prettyJSON } from "hono/pretty-json";
import { logger } from "hono/logger";
import {  notFound, protect } from "./middlewares";
import { users, customers, orders, payments } from "./routes";
import { user } from "./controllers";

config();

const app = new Hono().basePath("/api/v1");

// 🔹 Config MongoDB
connectDB();

// 🔹 Initialize middlewares
app.use("*", logger(), prettyJSON());

// 🔹 Cors
app.use(cors());

// 🔹 Health check
app.get("/health", (c) => {
  return c.text("API is healthy!");
});

// 🔹 Users Routes
app.route("/users", users);

// 🔹 Customers Routes
app.route("/customers", customers);

// 🔹 Orders Routes
app.route("/orders", orders);

// 🔹 Payments Routes
app.route("/payments", payments);

// 🔹 Get me
app.get("/auth/me", protect, (c) => user.getMe(c));

// 🔹 Global Error Handler
app.onError((error: any, c) => {
  console.error(error);
  return c.json(
    {
      success: false,
      message: error.message,
      stack: process.env.NODE_ENV === "production" ? null : error.stack,
    },
    500
  );
});

// 🔹 Not Found Handler
app.notFound((c) => {
  const error = notFound(c);
  return error;
});

const port = 3000;
console.log(`Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
