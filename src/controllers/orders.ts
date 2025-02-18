import { Customer, Order } from "../models";
import { Context } from "hono";
import { defaults } from "../config/defaults";
import { pagination } from "../lib";
import { z } from "zod";
import mongoose from "mongoose";
import { badRequestHandler, conflictHandler } from "../middlewares";
import idSchema from "./utils";

// 🔹Get all orders
const getOrders = async (c: Context) => {
  const page = parseInt(c.req.query("page") as string, 10) || defaults.page;
  const limit = parseInt(c.req.query("limit") as string, 10) || defaults.limit;
  const search = c.req.query("search") || defaults.search;
  const sortBy = c.req.query("sortBy") || defaults.sortBy;
  const sortType = c.req.query("sortType") || defaults.sortType;
  const fromDate = c.req.query("fromDate") || null;
  const toDate = c.req.query("toDate") || null;
  const customer = c.req.query("customer") || null;

  // Validate query parameters
  const querySchema = z.object({
    sortBy: z.string().optional().default(defaults.sortBy),
    sortType: z
      .enum(["asc", "desc"])
      .optional()
      .default(defaults.sortType as "asc" | "desc"),
    fromDate: z.date().nullish(),
    toDate: z.date().nullish(),
    customer: z
      .string()
      .refine((val) => mongoose.Types.ObjectId.isValid(val), {
        message: "Invalid MongoDB User ID format",
      })
      .nullish(),
  });

  // Safe Parse for better error handling
  const queryValidation = querySchema.safeParse({
    sortBy,
    sortType,
    fromDate,
    toDate,
    customer,
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
    // Date filter
    const dateFilter: any = {};
    if (queryValidation.data.fromDate && queryValidation.data.toDate) {
      dateFilter.$gte = new Date(queryValidation.data.fromDate);
      dateFilter.$lte = new Date(queryValidation.data.toDate);
    }

    // Query
    const query = {
      $or: [
        { customerName: { $regex: search, $options: "i" } },
        { customerPhone: { $regex: search, $options: "i" } },
      ],
      ...(queryValidation.data.fromDate && queryValidation.data.toDate
        ? { date: dateFilter }
        : {}), // sort by date range
      ...(queryValidation.data.customer
        ? { customerId: queryValidation.data.customer }
        : {}), // sort by customer ID for specific customer's orders
    };

    // Allowable sort fields
    const validSortFields = ["createdAt", "updatedAt", "name"];

    const sortField = validSortFields.includes(queryValidation.data.sortBy)
      ? queryValidation.data.sortBy
      : "updatedAt";
    const sortDirection =
      queryValidation.data.sortType.toLocaleLowerCase() === "asc" ? 1 : -1;

    // Get orders
    const orders = await Order.find(query)
      .sort({ [sortField]: sortDirection })
      .skip((page - 1) * limit)
      .limit(limit);

    // Get total orders
    const totalOrders = await Order.countDocuments(query);

    // Response
    return c.json(
      {
        success: true,
        message: "Orders fetched successfully",
        data: orders,
        pagination: pagination({ page, limit, total: totalOrders }),
      },
      200
    );
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: {
          message: error.message,
          code: 500,
        },
      },
      500
    );
  }
};

// 🔹 Create order
const registerOrder = async (c: Context) => {
  const body = await c.req.json();

  // Validate the data
  const bodySchema = z.object({
    customerId: z
      .any()
      .transform((val) =>
        val instanceof mongoose.Types.ObjectId ? val.toString() : val
      )
      .refine((val) => mongoose.Types.ObjectId.isValid(val), {
        message: "Invalid MongoDB User ID format",
      }),
    price: z.number().optional(),
    quantity: z.number().optional(),
    item: z.string().optional(),
    date: z
      .string()
      .refine(
        (dateStr) => {
          // 🔹 Check if format matches "YYYY-MM-DD"
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;

          // 🔹 Convert to Date Object
          const [year, month, day] = dateStr.split("-").map(Number);
          const date = new Date(year, month - 1, day); // JS months are 0-based

          // 🔹 Validate if Date is real (e.g., 2025-02-30 is invalid)
          return (
            date.getFullYear() === year &&
            date.getMonth() === month - 1 &&
            date.getDate() === day
          );
        },
        {
          message: "Invalid date or incorrect format (YYYY-MM-DD)",
        }
      )
      .transform((dateStr) => {
        // Convert valid string to Date Object
        const [day, month, year] = dateStr.split("-").map(Number);
        return new Date(year, month - 1, day);
      }),
    note: z.string().optional(),
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

  const { customerId, price, quantity, item, date, note } = bodyValidation.data;

  try {
    // Get customer
    const customer = await Customer.findById(customerId);

    // Check if customer exists
    if (!customer) {
      return badRequestHandler(c, {
        msg: "Invalid customer ID",
        fields: [{ name: "customerId", message: "Invalid customer ID" }],
      });
    }

    // Check order already exists or not for this customer on this date and item
    const existingOrder = await Order.findOne({
      customerId: customer._id,
      date,
      item: item ?? customer?.defaultItem,
    });

    // Return error if order already exists
    if (existingOrder) {
      return conflictHandler(c, {
        msg: "Order already exists for this customer on this date and item",
        fields: [
          { name: "date", message: "Order already exists for this date" },
        ],
      });
    }

    // Create order
    const order = new Order({
      customerId: customer._id,
      customerName: customer.name,
      customerPhone: customer.phone,
      price: price ?? customer.defaultPrice,
      quantity: quantity ?? customer.defaultQuantity,
      item: item ?? customer.defaultItem,
      date,
      note,
    });

    // Save order
    const docs = await order.save();

    // Update Customer amount
    const totalAmount = docs.total ?? 0;

    // Update customer amount
    customer.amount += totalAmount;
    await customer.save();

    // Response
    return c.json(
      {
        success: true,
        message: "Order created successfully",
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

// 🔹 Get single order
const getSingleOrder = async (c: Context) => {
  const id = c.req.param("id");

  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return badRequestHandler(c, {
      msg: String(idValidation.error.issues[0].message),
    });
  }

  try {
    // Check if order exists
    const order = await Order.findById(idValidation.data.id);

    if (!order) {
      return badRequestHandler(c, {
        msg: "Order not found with provided ID",
      });
    }

    // Response
    return c.json(
      {
        success: true,
        message: "Order fetched successfully",
        data: order,
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

// 🔹 Update order
const updateOrder = async (c: Context) => {
  const id = c.req.param("id");

  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return badRequestHandler(c, {
      msg: String(idValidation.error.issues[0].message),
    });
  }

  const body = await c.req.json();

  // Validate the data
  const bodySchema = z.object({
    price: z.number().min(1).optional(),
    quantity: z.number().min(1).optional(),
    item: z.enum(["lunch", "dinner", "lunch&dinner"]).optional(),
    note: z.string().optional(),
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

  try {
    // Check if order exists
    const order = await Order.findById(idValidation.data.id);

    if (!order) {
      return badRequestHandler(c, {
        msg: "Order not found with provided ID",
      });
    }

    // Check if data is provided
    if (Object.keys(bodyValidation.data).length === 0) {
      return c.json(
        {
          success: true,
          error: {
            message: "No updates provided, returning existing order",
            code: 400,
          },
          data: order,
        },
        400
      );
    }

    // Get previous total for calculations
    const prevTotal = order.total ?? 0;

    // Update order only if data is provided
    Object.assign(order, bodyValidation.data);

    // Save order
    const docs = await order.save();

    // Update Customer amount after order update
    const newTotal = docs.total ?? 0;

    // Update customer amount
    const customer = await Customer.findById(order.customerId);
    if (customer) {
      customer.amount += newTotal - prevTotal;
      await customer.save();
    }

    // Response
    return c.json(
      {
        success: true,
        message: "Order updated successfully",
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

// 🔹 Delete order
const deleteOrder = async (c: Context) => {
  const id = c.req.param("id");

  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return badRequestHandler(c, {
      msg: String(idValidation.error.issues[0].message),
    });
  }

  try {
    // Check if order exists
    const order = await Order.findById(idValidation.data.id);
    if (!order) {
      return badRequestHandler(c, {
        msg: "Order not found with provided ID",
      });
    }

    // Delete order
    await order.deleteOne();

    // Update customer amount
    const customer = await Customer.findById(order.customerId);
    if (customer) {
      customer.amount -= order.total ?? 0;
      await customer.save();
    }

    // Response
    return c.json(
      {
        success: true,
        message: "Order deleted successfully",
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

export { getOrders, registerOrder, getSingleOrder, updateOrder, deleteOrder };
