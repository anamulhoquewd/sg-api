import { z } from "zod";
import { defaults } from "../config/defaults";
import mongoose from "mongoose";
import { Customer, Order } from "../models";
import { pagination } from "../lib";
import idSchema from "../controllers/utils";
import { schemaValidationError, calculatePercentage } from "./utile";
import {
  endOfDay,
  endOfMonth,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns";

interface GetOrderServiceProps {
  page: number;
  limit: number;
  sortBy: string;
  sortType: string;
  search: string;
  fromDate: Date | null;
  toDate: Date | null;
  date: Date | null;
  customer: string | null;
}

export const getOrdersService = async (queryParams: GetOrderServiceProps) => {
  const {
    page,
    limit,
    sortBy,
    sortType,
    search,
    fromDate,
    toDate,
    customer,
    date,
  } = queryParams;

  // Validate query parameters
  const querySchema = z.object({
    sortBy: z.string().optional().default(defaults.sortBy),
    sortType: z
      .enum(["asc", "desc"])
      .optional()
      .default(defaults.sortType as "asc" | "desc"),
    fromDate: z.date().nullish(),
    toDate: z.date().nullish(),
    date: z.date().nullish(),
    customer: z
      .string()
      .refine((val) => mongoose.Types.ObjectId.isValid(val), {
        message: "Invalid MongoDB Order ID format",
      })
      .nullish(),
  });

  // Safe Parse for better error handling
  const queryValidation = querySchema.safeParse({
    sortBy,
    sortType,
    fromDate: fromDate ? new Date(fromDate) : null,
    toDate: toDate ? new Date(toDate) : null,
    date: date ? new Date(date) : null,
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
      ...(queryValidation.data.date
        ? {
            // date: {
            //   $gte: new Date(queryValidation.data.date),
            //   $lt: new Date(
            //     new Date(queryValidation.data.date).getTime() + 86400000
            //   ), // Next day
            // },
            date: new Date(queryValidation.data.date),
          }
        : {}),
    };

    // Allowable sort fields
    const validSortFields = ["createdAt", "updatedAt", "name", "date"];

    const sortField = validSortFields.includes(queryValidation.data.sortBy)
      ? queryValidation.data.sortBy
      : "date";
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

export const getOrdersCountService = async ({ id }: { id: string }) => {
  const querySchema = z.object({
    id: z
      .string()
      .refine((val) => mongoose.Types.ObjectId.isValid(val), {
        message: "Invalid MongoDB Order ID format",
      })
      .nullish(),
  });

  // Safe Parse for better error handling
  const queryValidation = querySchema.safeParse({
    id,
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
    // If a customer ID is provided, return only their total orders
    if (queryValidation.data?.id) {
      const totalOrders = await Order.countDocuments({
        customerId: queryValidation.data.id,
      });
      return {
        success: {
          success: true,
          message: "Orders counted",
          data: { totalOrders },
        },
      };
    }

    // 1. Today's range (start and end of day)
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    // 2. Yesterday's range (start and end of yesterday)
    const yesterdayStart = startOfDay(subDays(new Date(), 1));
    const yesterdayEnd = endOfDay(subDays(new Date(), 1));

    // 3. Current month's range (start and end of month)
    const currentMonthStart = startOfMonth(new Date());
    const currentMonthEnd = endOfMonth(new Date());

    // 4. Previous month's range (start and end of last month)
    const prevMonthStart = startOfMonth(subMonths(new Date(), 1));
    const prevMonthEnd = endOfMonth(subMonths(new Date(), 1));

    // 5. Current year's rang (start and end of last year)
    const currentYearStart = startOfYear(new Date());
    const currentYearEnd = endOfYear(new Date());

    // 6. Previous year's rang (start and end of last year)
    const prevYearStart = startOfYear(subYears(new Date(), 1));
    const prevYearEnd = endOfYear(subYears(new Date(), 1));

    // 7. Fetch counts using MongoDB queries
    const [
      todayOrders,
      yesterdayOrders,
      currentMonthOrders,
      prevMonthOrders,
      currentYearOrders,
      prevYearOrders,
      totalOrders,
    ] = await Promise.all([
      Order.countDocuments({ date: { $gte: todayStart, $lte: todayEnd } }),
      Order.countDocuments({
        date: { $gte: yesterdayStart, $lte: yesterdayEnd },
      }),
      Order.countDocuments({
        date: { $gte: currentMonthStart, $lte: currentMonthEnd },
      }),
      Order.countDocuments({
        date: { $gte: prevMonthStart, $lte: prevMonthEnd },
      }),
      Order.countDocuments({
        date: { $gte: currentYearStart, $lte: currentYearEnd },
      }),
      Order.countDocuments({
        date: { $gte: prevYearStart, $lte: prevYearEnd },
      }),
      Order.countDocuments({}),
    ]);

    const dailyChangePercent = calculatePercentage(
      todayOrders,
      yesterdayOrders
    );
    const monthlyChangePercent = calculatePercentage(
      currentMonthOrders,
      prevMonthOrders
    );
    const yearlyChangePercent = calculatePercentage(
      currentYearOrders,
      prevYearOrders
    );

    return {
      success: {
        success: true,
        message: "Orders counted",
        data: {
          dailyChange: `${dailyChangePercent}%`,
          monthlyChange: `${monthlyChangePercent}%`,
          yearlyChange: `${yearlyChangePercent}%`,
          todayOrders,
          yesterdayOrders,
          currentMonthOrders,
          prevMonthOrders,
          totalOrders,
        },
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
      .transform((value) =>
        value instanceof mongoose.Types.ObjectId ? value.toString() : value
      )
      .refine((value) => mongoose.Types.ObjectId.isValid(value), {
        message: "Invalid MongoDB Order ID format",
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
          message: "Invalid date or incorrect format (yyyy-MM-dd)",
        }
      )
      .transform((dateStr) => {
        // Convert valid string to Date Object
        const [year, month, day] = dateStr.split("-").map(Number);
        return new Date(Date.UTC(year, month - 1, day)).toISOString();
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

  console.log("Date for register a order", date);

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
            {
              name: "date",
              message: `Order already exists for this date ${
                new Date(date).toISOString().split("T")[0]
              }`,
            },
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
    return { error: schemaValidationError(idValidation.error, "Invalid ID") };
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
    return { error: schemaValidationError(idValidation.error, "Invalid ID") };
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
    return { error: schemaValidationError(idValidation.error, "Invalid ID") };
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
