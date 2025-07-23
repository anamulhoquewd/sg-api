import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { config } from "dotenv";
import { connectDB } from "./config/db";
import { cors } from "hono/cors";
import { prettyJSON } from "hono/pretty-json";
import { logger } from "hono/logger";
import { notFound, protect } from "./middlewares";
import { admins, customers, orders, payments, products } from "./routes";
import { adminsService } from "./services";
import categories from "./routes/categories";

config();

const app = new Hono().basePath("/api/v1");

// Config MongoDB
connectDB()
  .then(async () => {
    // Call the Super Admin Service function after connecting to MongoDB
    const result = await adminsService.superAdminService();

    if (result.success) {
      console.log(result.message || "Super admin created successfully!");
    } else {
      console.log(result.error?.message);
    }
  })
  .catch((error) => {
    console.error("Failed to initialize super admin:", error);
  });

// Initialize middlewares
app.use("*", logger(), prettyJSON());

// CORS
app.use(
  cors({
    origin: "http://localhost:3001", // Your frontend URL
    credentials: true, // Allow cookies
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE"], // Ensure OPTIONS is handled
    allowHeaders: ["Content-Type", "Authorization"], // Allow necessary headers
  })
);

// Health check
app.get("/health", (c) => c.text("API is healthy!"));

// Admins Routes
app.route("/admins", admins);

// Categories Routes
app.route("/categories", categories);

// Customers Routes
app.route("/customers", customers);

// Products Routes
app.route("/products", products);

// Orders Routes
app.route("/orders", orders);

// Payments Routes
app.route("/payments", payments);

// Global Error Handler
app.onError((error: any, c) => {
  console.error("error: ", error);
  return c.json(
    {
      success: false,
      message: error.message,
      stack: process.env.NODE_ENV === "production" ? null : error.stack,
    },
    500
  );
});

// Not Found Handler
app.notFound((c) => {
  const error = notFound(c);
  return error;
});

const port = Number(process.env.PORT) || 3000;
console.log(`Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
