import { z } from "zod";
import { defaults } from "../config/defaults";
import mongoose from "mongoose";
import { Customer, Order } from "../models";
import { pagination } from "../lib";
import idSchema from "../controllers/utils";
import { schemaValidationError } from "./utile";

export const getOrdersService = async (queryParams: {
  page: number;
  limit: number;
  sortBy: string;
  sortType: string;
  search: string;
  fromDate: string | null;
  toDate: string | null;
  customer: string | null;
}) => {
  const { page, limit, sortBy, sortType, search, fromDate, toDate, customer } =
    queryParams;

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
    return {
      error: schemaValidationError(
        queryValidation.error,
        "Invalid query parameters"
      ),
    };
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

    const getPagination = pagination({ page, limit, total: totalOrders });

    // Response
    return {
      success: {
        success: true,
        message: "Orders fetched successfully",
        data: orders,
        pagination: getPagination,
      },
    };
  } catch (error: any) {
    return {
      serverError: {
        success: false,
        error: {
          message: error.message,
          code: 500,
        },
      },
    };
  }
};

export const registerOrderService = async (body: {
  customerId: string;
  price: number;
  quantity: number;
  item: "lunch" | "dinner" | "lunch&dinner";
  date: Date;
  note: string;
}) => {
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
    item: z.enum(["lunch", "dinner", "lunch&dinner"]).optional(),
    date: z
      .string()
      .refine(
        (dateStr) => {
          // Check if format matches "YYYY-MM-DD"
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;

          // Convert to Date Object
          const [year, month, day] = dateStr.split("-").map(Number);
          const date = new Date(year, month - 1, day); // JS months are 0-based

          // Validate if Date is real (e.g., 2025-02-30 is invalid)
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
    console.log(bodyValidation.error.issues[0].message);
    return {
      error: schemaValidationError(
        bodyValidation.error,
        "Invalid request body"
      ),
    };
  }

  const { customerId, price, quantity, item, date, note } = bodyValidation.data;

  try {
    // Get customer
    const customer = await Customer.findById(customerId);

    // Check if customer exists
    if (!customer) {
      return {
        error: {
          msg: "Invalid customer ID",
          fields: [{ name: "customerId", message: "Invalid customer ID" }],
        },
      };
    }

    // Check order already exists or not for this customer on this date and item
    const existingOrder = await Order.findOne({
      customerId: customer._id,
      date,
      item: item ?? customer?.defaultItem,
    });

    // Return error if order already exists
    if (existingOrder) {
      return {
        error: {
          msg: "Order already exists for this customer on this date and item",
          fields: [
            { name: "date", message: "Order already exists for this date" },
          ],
        },
      };
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
    return {
      success: {
        success: true,
        message: "Order created successfully",
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

export const getSingleOrderService = async (id: string) => {
  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return schemaValidationError(idValidation.error, "Invalid ID");
  }

  try {
    // Check if order exists
    const order = await Order.findById(idValidation.data.id);

    if (!order) {
      return {
        error: {
          msg: "Order not found with provided ID",
        },
      };
    }

    // Response
    return {
      success: {
        success: true,
        message: "Order fetched successfully",
        data: order,
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

export const updateOrderService = async ({
  id,
  body,
}: {
  id: string;
  body: {
    price: number;
    quantity: number;
    item: "lunch" | "dinner" | "lunch&dinner";
    note: string;
  };
}) => {
  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return schemaValidationError(idValidation.error, "Invalid ID");
  }

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
    return {
      error: schemaValidationError(
        bodyValidation.error,
        "Invalid request body"
      ),
    };
  }

  try {
    // Check if order exists
    const order = await Order.findById(idValidation.data.id);

    if (!order) {
      return {
        error: {
          msg: "Order not found with provided ID",
        },
      };
    }

    // Check if data is provided
    if (Object.keys(bodyValidation.data).length === 0) {
      return {
        success: {
          success: true,
          message: "No updates provided, returning existing order",
          data: order,
        },
      };
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
    return {
      success: {
        success: true,
        message: "Order updated successfully",
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

export const deleteOrderService = async (id: string) => {
  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return schemaValidationError(idValidation.error, "Invalid ID");
  }

  try {
    // Check if order exists
    const order = await Order.findById(idValidation.data.id);
    if (!order) {
      return {
        error: {
          msg: "Order not found with provided ID",
        },
      };
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
    return {
      success: {
        success: true,
        message: "Order deleted successfully",
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
