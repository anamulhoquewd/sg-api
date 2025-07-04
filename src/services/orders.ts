import { z } from "zod";
import { defaults } from "../config/defaults";
import mongoose from "mongoose";
import { Customer, Order, Product } from "../models";
import { pagination } from "../lib";
import idSchema from "../utils/utils";
import { schemaValidationError } from "./utile";

import { OrderDocument, OrderItem, orderZodValidation } from "../models/Orders";
import { registerCustomerService } from "./customers";

interface GetOrderServiceProps {
  page: number;
  limit: number;
  sortBy: string;
  sortType: string;
  dateRange?: {
    from: string | Date | undefined;
    to: string | Date | undefined;
  };
  date?: string;
  customer?: string;
  status?: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  paymentStatus?: "paid" | "unpaid";
  search?: string;
  product?: string;
  amountRange?: {
    min: number | undefined;
    max: number | undefined;
  };
}

// Suppose you receive filters from request query, e.g., /orders?status=pending&minAmount=5000
function buildOrderQuery(filters: {
  status?: string;
  paymentStatus?: string;
  amountRange?: { min?: number; max?: number };
  date?: string | Date;
  dateRange?: { from?: string | Date; to?: string | Date };
  customerId?: string;
  search?: string;
  productId?: string;
}) {
  const query: any = {};

  // Search with ID
  if (filters.search) {
    query._id = filters.search;
  }

  // Status filter
  if (filters.status) {
    query.status = filters.status;
  }

  // Payment status filter
  if (filters.paymentStatus) {
    query.paymentStatus = filters.paymentStatus;
  }

  // Amount range filter
  if (
    filters.amountRange &&
    filters.amountRange.min &&
    filters.amountRange.max
  ) {
    // Length should be 2
    query.amount = {};
    if (filters.amountRange.min)
      query.amount.$gte = Number(filters.amountRange.min);
    if (filters.amountRange.max)
      query.amount.$lte = Number(filters.amountRange.max);
    // Cleanup if empty
    if (Object.keys(query.amount).length === 0) delete query.amount;
  }

  // Date filters: createdAt between fromDate and toDate
  if (filters.dateRange && filters.dateRange.from && filters.dateRange.to) {
    // Length should be 2
    query.createdAt = {};
    if (filters.dateRange.from)
      query.createdAt.$gte = new Date(filters.dateRange.from);
    if (filters.dateRange.to)
      query.createdAt.$lte = new Date(filters.dateRange.to);
    if (Object.keys(query.createdAt).length === 0) delete query.createdAt;
  }

  // Date filter
  if (filters.date) {
    const date = new Date(filters.date);

    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + 1);

    query.createdAt = {
      $gte: date,
      $lt: nextDate,
    };
  }

  // Customer ID filter
  if (filters.customerId) {
    query.customer = filters.customerId;
  }

  // Filter for a specific product inside items array
  if (filters.productId) {
    query["items.product"] = filters.productId;
  }

  return query;
}

export const registerOrderService = async (body: OrderDocument) => {
  // Safe Parse for better error handling
  const bodyValidation = orderZodValidation.safeParse(body);

  if (!bodyValidation.success) {
    return {
      error: schemaValidationError(
        bodyValidation.error,
        "Invalid request body"
      ),
    };
  }

  const { items, address, name, phone, deliveryCost } = bodyValidation.data;

  try {
    // Get customer
    let customer = await Customer.findOne({ phone });

    // Check if customer exists
    if (!customer) {
      const response = await registerCustomerService({
        name,
        phone,
        address: address,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.serverError) {
        throw new Error(response.serverError.message);
      }

      customer = response.success.data;
    }

    // collect stock errors
    const stockErrors: string[] = [];

    const productPromises = items.map((item) => Product.findById(item.product));
    const products = await Promise.all(productPromises);

    const addedProductIds = new Set<string>();
    const productsObject = await products.reduce(
      async (prevAcc, product, index) => {
        const acc = await prevAcc;
        if (!product || product.unit.stockQuantity < 0) return acc;

        const productIdStr = product._id.toString();

        // Check duplication using Set
        if (addedProductIds.has(productIdStr)) return acc;

        const quantity = items[index].quantity ?? 1;
        const currentStock = product.unit.stockQuantity;

        if (currentStock <= 0 || quantity > currentStock) {
          stockErrors.push(
            `Insufficient stock for product "${product.name}". Available: ${currentStock}, Requested: ${quantity}`
          );
          return acc;
        }

        const total = product.unit.price * quantity;
        const newStock = currentStock - quantity;

        // Determine status
        let newStatus: "inStock" | "lowStock" | "outOfStock" = "inStock";
        if (newStock <= 0) newStatus = "outOfStock";
        else if (newStock <= product.lowStockThreshold) newStatus = "lowStock";

        // Update DB
        await Product.findByIdAndUpdate(product._id, {
          $set: {
            "unit.stockQuantity": Math.max(newStock, 0),
            status: newStatus,
          },
        });

        // Add to accumulator
        acc.items.push({
          product: product._id,
          quantity,
          name: product.name,
          price: product.unit.price,
          total,
        });

        acc.amount += total;

        // Mark as added
        addedProductIds.add(productIdStr);

        return acc;
      },
      Promise.resolve({
        items: [] as {
          product: mongoose.Types.ObjectId;
          quantity: number;
          name: string;
          price: number;
          total: number;
        }[],
        amount: 0,
      })
    );

    // return with error if any stock issues
    if (stockErrors.length > 0) {
      return {
        error: {
          message: stockErrors.join(" | "),
        },
      };
    }

    if (productsObject.items.length <= 0) {
      return {
        error: {
          message: "At least one product is required.",
        },
      };
    }

    // Create order
    const order = new Order({
      customer: customer._id,
      items: productsObject.items,
      address,
      deliveryCost,
      amount: productsObject.amount + deliveryCost,
    });

    // Save order
    const docs = await order.save();

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

export const getOrdersService = async (queryParams: GetOrderServiceProps) => {
  // Validate query parameters
  const isValidDate = (val: string) => !isNaN(Date.parse(val));
  const querySchema = z.object({
    sortBy: z.string().optional().default(defaults.sortBy),
    sortType: z
      .enum(["asc", "desc"])
      .optional()
      .default(defaults.sortType as "asc" | "desc"),

    dateRange: z
      .object({
        from: z
          .string()
          .optional()
          .refine((val) => val === undefined || isValidDate(val), {
            message: "Invalid from date",
          }),
        to: z
          .string()
          .optional()
          .refine((val) => val === undefined || isValidDate(val), {
            message: "Invalid to date",
          }),
      })
      .optional(),
    date: z
      .string()
      .refine((val) => isValidDate(val), { message: "Invalid date" })
      .optional(),

    customer: z
      .string()
      .refine((val) => mongoose.Types.ObjectId.isValid(val), {
        message: "Invalid MongoDB Order ID format",
      })
      .optional(),

    product: z
      .string()
      .refine((val) => mongoose.Types.ObjectId.isValid(val), {
        message: "Invalid MongoDB Order ID format",
      })
      .optional(),

    status: z
      .enum(["pending", "processing", "shipped", "delivered", "cancelled"])
      .optional(),

    search: z.string().optional(),

    paymentStatus: z.enum(["paid", "pending", "refunded", "failed"]).optional(),

    amountRange: z
      .object({
        min: z.preprocess((val) => Number(val), z.number()).optional(),
        max: z.preprocess((val) => Number(val), z.number()).optional(),
      })
      .optional(),
  });

  // Safe Parse for better error handling
  const queryValidation = querySchema.safeParse(queryParams);

  console.log("QueryValidation: ", queryValidation);
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
    if (
      queryValidation.data.dateRange &&
      queryValidation.data.dateRange.from &&
      queryValidation.data.dateRange.to
    ) {
      dateFilter.$gte = new Date(queryValidation.data.dateRange.from);
      dateFilter.$lte = new Date(queryValidation.data.dateRange.to);
    }

    // Query
    const query = buildOrderQuery({
      status: queryValidation.data.status,
      paymentStatus: queryValidation.data.paymentStatus,

      customerId: queryValidation.data.customer,
      productId: queryValidation.data.product,

      amountRange: queryValidation.data.amountRange,

      search: queryValidation.data.search,

      date: queryValidation.data.date,
      dateRange: queryValidation.data.dateRange,
    });

    // Allowable sort fields
    const sortField = ["createdAt", "updatedAt"].includes(
      queryValidation.data.sortBy
    )
      ? queryValidation.data.sortBy
      : "createdAt";
    const sortDirection =
      queryValidation.data.sortType.toLocaleLowerCase() === "asc" ? 1 : -1;

    // Get orders
    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ [sortField]: sortDirection })
        .skip((queryParams.page - 1) * queryParams.limit)
        .limit(queryParams.limit)
        .populate("customer")
        .exec(),

      Order.countDocuments(query),
    ]);

    // Pagination
    const getPagination = pagination({
      page: queryParams.page,
      limit: queryParams.limit,
      total,
    });
    console.log("Query: ", query);

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
          message: "Order not found with provided ID",
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

export const updateOrderStatueService = async ({
  id,
  body,
}: {
  id: string;
  body: {
    status: "shipped" | "delivered" | "cancelled" | "pending" | "processing";
    paymentStatus: "pending" | "paid" | "failed" | "refunded";
  };
}) => {
  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return { error: schemaValidationError(idValidation.error, "Invalid ID") };
  }

  // Validate the data
  const bodySchema = z.object({
    status: z
      .enum(["shipped", "delivered", "cancelled", "pending", "processing"])
      .optional(),
    paymentStatus: z.enum(["pending", "paid", "failed", "refunded"]).optional(),
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
          message: "Order not found with provided ID",
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

    if (bodyValidation.data.status) {
      order.status = bodyValidation.data.status;
    }
    if (bodyValidation.data.paymentStatus) {
      order.paymentStatus = bodyValidation.data.paymentStatus;
    }

    // Save order
    const docs = await order.save();

    // Response
    return {
      success: {
        success: true,
        message: "Order status updated successfully",
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

export const updateOrderAdjustmentService = async ({
  id,
  body,
}: {
  id: string;
  body: {
    amount: number;
    type: "addition" | "discount";
  };
}) => {
  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return { error: schemaValidationError(idValidation.error, "Invalid ID") };
  }

  // Validate the data
  const bodySchema = z.object({
    amount: z.number(),
    type: z.enum(["addition", "discount"]),
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
          message: "Order not found with provided ID",
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

    if (bodyValidation.data.amount) {
      order.amount =
        bodyValidation.data.type === "addition"
          ? order.amount + bodyValidation.data.amount
          : order.amount - bodyValidation.data.amount;
    }

    // Save order
    const docs = await order.save();

    // Response
    return {
      success: {
        success: true,
        message: "Order amount adjustment updated successfully",
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

export const updateOrderItemsService = async ({
  id,
  body,
}: {
  id: string;
  body: {
    items: OrderItem[];
    newAmount: number;
  };
}) => {
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return { error: schemaValidationError(idValidation.error, "Invalid ID") };
  }

  const bodyValidationSchema = z.object({
    items: z.array(
      z.object({
        product: z
          .any()
          .transform((val) =>
            val instanceof mongoose.Types.ObjectId ? val.toString() : val
          )
          .refine((val) => mongoose.Types.ObjectId.isValid(val), {
            message: "Invalid MongoDB Document ID format",
          }),
        quantity: z.number().min(1, "Quantity must be at least 1"),
        name: z.string(),
        total: z.number(),
        price: z.number(),
      })
    ),
    newAmount: z.number(),
  });

  const bodyValidation = bodyValidationSchema.safeParse(body);
  if (!bodyValidation.success) {
    return {
      error: schemaValidationError(
        bodyValidation.error,
        "Invalid request body"
      ),
    };
  }

  const { items, newAmount } = bodyValidation.data;

  try {
    const order = await Order.findById(idValidation.data.id);
    if (!order) {
      return {
        error: {
          message: "Order not found with provided ID",
        },
      };
    }

    if (!items.length) {
      return {
        error: {
          message: "If no items are available, delete the order.",
        },
      };
    }

    // Validate and update stock
    const productDocs = await Product.find({
      _id: { $in: items.map((item) => item.product) },
    });

    const stockErrors: string[] = [];

    for (const item of items) {
      const product = productDocs.find(
        (p) => p._id.toString() === item.product
      );
      if (!product) {
        stockErrors.push(`Product not found for ID ${item.product}`);
        continue;
      }

      const existingItemInOrder = order.items.find(
        (i) => i.product.toString() === item.product
      );

      const previousQuantity = existingItemInOrder?.quantity ?? 0;
      const newQuantity = item.quantity;

      // Calculate difference: if positive → stock going to minus, negative → plus
      const stockDelta = previousQuantity - newQuantity;

      const currentStock = product.unit.stockQuantity;

      // Available stock check only if need to decrease stock
      if (stockDelta < 0 && Math.abs(stockDelta) > currentStock) {
        stockErrors.push(
          `Insufficient stock for product "${
            product.name
          }". Available: ${currentStock}, Requested extra: ${Math.abs(
            stockDelta
          )}`
        );
        continue;
      }

      const updatedStock = currentStock + stockDelta;

      // Determine new status
      let newStatus: "inStock" | "lowStock" | "outOfStock" = "inStock";
      if (updatedStock <= 0) newStatus = "outOfStock";
      else if (updatedStock <= product.lowStockThreshold)
        newStatus = "lowStock";

      // Update DB
      await Product.findByIdAndUpdate(product._id, {
        $set: {
          "unit.stockQuantity": Math.max(updatedStock, 0),
          status: newStatus,
        },
      });
    }

    if (stockErrors.length) {
      return {
        errors: { message: stockErrors },
      };
    }

    order.items = items as OrderItem[];
    order.amount = newAmount;
    const updatedOrder = await order.save();

    return {
      success: {
        success: true,
        message: "Order updated successfully",
        data: updatedOrder,
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
          message: "Order not found with provided ID",
        },
      };
    }

    // Restore product quantities
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity },
      });
    }

    // Delete order
    await order.deleteOne();

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
