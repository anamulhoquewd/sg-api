import { boolean, number, z } from "zod";
import { defaults } from "../config/defaults";
import mongoose from "mongoose";
import { Customer, Order, Product } from "../models";
import { pagination } from "../lib";
import idSchema from "../utils/utils";
import { schemaValidationError } from "./utile";

import { OrderDocument, orderZodValidation } from "../models/Orders";
import { registerCustomerService } from "./customers";

interface GetOrderServiceProps {
  page: number;
  limit: number;
  sortBy: string;
  sortType: string;

  fromDate?: string;
  toDate?: string;
  date?: string;
  customer?: string;
  status?: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  paymentStatus?: "paid" | "unpaid";
  search: string;
  product?: string;
  minAmount?: number;
  maxAmount?: number;
}

interface DiscountInfo {
  originalPrice: number;
  discountType: "percentage" | "flat" | undefined;
  discountValue: number;
  discountExp: string | Date;
}

export const calculateFinalPrice = ({
  originalPrice,
  discountType,
  discountValue = 0,
  discountExp,
}: DiscountInfo): number => {
  const price = originalPrice;

  const isExpired = discountExp && new Date(discountExp) < new Date();

  if (isExpired) {
    discountValue = 0;
  }

  let finalPrice = price;

  if (discountType === "percentage") {
    finalPrice = price - (price * discountValue) / 100;
  } else if (discountType === "flat") {
    finalPrice = price - discountValue;
  }

  return finalPrice < 0 ? 0 : finalPrice; // ensure no negative price
};

export const registerOrderService = async (body: OrderDocument) => {
  // Safe Parse for better error handling
  const bodyValidation = orderZodValidation
    .extend({
      name: z.string(),
      phone: z.string(),
      address: z.string().optional(),
    })
    .safeParse(body);

  if (!bodyValidation.success) {
    return {
      error: schemaValidationError(
        bodyValidation.error,
        "Invalid request body"
      ),
    };
  }

  const { items, deliveryAddress, name, phone, address } = bodyValidation.data;

  try {
    // Get customer
    let customer = await Customer.findOne({ phone });

    // Check if customer exists
    if (!customer) {
      const response = await registerCustomerService({
        name,
        phone,
        address: address ?? deliveryAddress,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.serverError) {
        throw new Error(response.serverError.message);
      }

      customer = response.success.data;
    }

    // console.log("Items: ", items);

    // collect stock errors
    const stockErrors: string[] = [];

    const productPromises = items.map((item) => Product.findById(item.product));
    const products = await Promise.all(productPromises);

    const productsObject = await products.reduce(
      async (prevAcc, product, index) => {
        const acc = await prevAcc;
        if (!product || !product.unit || product.unit.stockQuantity < 0)
          return acc;

        const quantity = items[index].quantity ?? 1;
        const currentStock = product.unit.stockQuantity;

        if (currentStock <= 0 || quantity > currentStock) {
          stockErrors.push(
            `Insufficient stock for product "${product.name}". Available: ${currentStock}, Requested: ${quantity}`
          );
          return acc; // Skip this product
        }

        const finalPrice = calculateFinalPrice({
          discountExp: product.discount?.discountExp || new Date(),
          discountValue: product.discount?.discountValue || 0,
          originalPrice: product.unit.originalPrice || 0,
          discountType: product.discount?.discountType || undefined,
        });

        // Update stock
        const newStock = product.unit.stockQuantity - quantity;

        // Determine new status
        let newStatus = "inStock";
        if (newStock <= 0) newStatus = "outOfStock";
        else if (newStock <= product.lowStockThreshold) newStatus = "lowStock";

        // Update product
        await Product.findByIdAndUpdate(product._id, {
          $set: {
            "unit.stockQuantity": newStock < 0 ? 0 : newStock,
            status: newStatus,
          },
        });

        acc.items.push({
          product: product._id,
          quantity,
        });

        acc.amount += finalPrice * quantity;

        console.log(
          `Updated ${product.name} → Stock: ${newStock}, Status: ${newStatus}`
        );

        return acc;
      },
      Promise.resolve({
        items: [] as { product: mongoose.Types.ObjectId; quantity: number }[],
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
      deliveryAddress,
      amount: productsObject.amount,
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

// Suppose you receive filters from request query, e.g., /orders?status=pending&minAmount=5000
function buildOrderQuery(filters: {
  status?: string;
  paymentStatus?: string;
  minAmount?: number;
  maxAmount?: number;
  fromDate?: string | Date;
  toDate?: string | Date;
  date?: string | Date;
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
  if (filters.minAmount || filters.maxAmount) {
    query.amount = {};
    if (filters.minAmount) query.amount.$gte = Number(filters.minAmount);
    if (filters.maxAmount) query.amount.$lte = Number(filters.maxAmount);
    // Cleanup if empty
    if (Object.keys(query.amount).length === 0) delete query.amount;
  }

  // Date filters: createdAt between fromDate and toDate
  if (filters.fromDate || filters.toDate) {
    query.createdAt = {};
    if (filters.fromDate) query.createdAt.$gte = new Date(filters.fromDate);
    if (filters.toDate) query.createdAt.$lte = new Date(filters.toDate);
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

export const getOrdersService = async (queryParams: GetOrderServiceProps) => {
  const {
    page,
    limit,
    sortBy,
    sortType,

    fromDate,
    toDate,
    date,

    customer,
    product,

    search,

    paymentStatus,
    status,

    minAmount,
    maxAmount,
  } = queryParams;

  // Validate query parameters
  const isValidDate = (val: string) => !isNaN(Date.parse(val));
  const querySchema = z.object({
    sortBy: z.string().optional().default(defaults.sortBy),
    sortType: z
      .enum(["asc", "desc"])
      .optional()
      .default(defaults.sortType as "asc" | "desc"),

    fromDate: z
      .string()
      .refine((val) => isValidDate(val), { message: "Invalid fromDate" })
      .optional(),
    toDate: z
      .string()
      .refine((val) => isValidDate(val), { message: "Invalid toDate" })
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

    paymentStatus: z.enum(["paid", "unpaid"]).optional(),

    maxAmount: z.preprocess((val) => Number(val), z.number()).optional(),
    minAmount: z.preprocess((val) => Number(val), z.number()).optional(),
  });

  // Safe Parse for better error handling
  const queryValidation = querySchema.safeParse({
    sortBy,
    sortType,

    fromDate: fromDate,
    toDate: toDate,
    date: date,

    customer,
    product,

    search,

    status,
    paymentStatus,

    maxAmount,
    minAmount,
  });

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
    if (queryValidation.data.fromDate && queryValidation.data.toDate) {
      dateFilter.$gte = new Date(queryValidation.data.fromDate);
      dateFilter.$lte = new Date(queryValidation.data.toDate);
    }

    // Query
    const query = buildOrderQuery({
      status: queryValidation.data.status,
      paymentStatus: queryValidation.data.paymentStatus,

      customerId: queryValidation.data.customer,
      productId: queryValidation.data.product,

      search: queryValidation.data.search,

      maxAmount: queryValidation.data.maxAmount,
      minAmount: queryValidation.data.minAmount,

      date: queryValidation.data.date,
      fromDate: queryValidation.data.fromDate,
      toDate: queryValidation.data.toDate,
    });

    // Allowable sort fields
    const sortField = ["createdAt", "updatedAt"].includes(
      queryValidation.data.sortBy
    )
      ? queryValidation.data.sortBy
      : "updatedAt";
    const sortDirection =
      queryValidation.data.sortType.toLocaleLowerCase() === "asc" ? 1 : -1;

    // Get orders
    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ [sortField]: sortDirection })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("customer")
        .populate({
          path: "items.product",
          model: "Product", // Assuming your product model is named 'Product'
        })
        .exec(),

      Order.countDocuments(query),
    ]);

    // Pagination
    const getPagination = pagination({
      page: page,
      limit: limit,
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

export const updateOrderService = async ({
  id,
  body,
}: {
  id: string;
  body: {
    status: "shipped" | "delivered" | "cancelled" | "pending";
    paymentStatus: "unpaid" | "paid";
    deliveryAddress: string;
    amount: number;
    item: { product: string; quantity: number };
  };
}) => {
  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return { error: schemaValidationError(idValidation.error, "Invalid ID") };
  }

  // Validate the data
  const bodySchema = z.object({
    status: z.enum(["shipped", "delivered", "cancelled", "pending"]).optional(),
    paymentStatus: z.enum(["paid", "unpaid"]).optional(),
    amount: z.number().optional(),
    deliveryAddress: z.string().optional(),
    item: z
      .object({
        product: z
          .any()
          .transform((val) =>
            val instanceof mongoose.Types.ObjectId ? val.toString() : val
          )
          .refine((val) => mongoose.Types.ObjectId.isValid(val), {
            message: "Invalid MongoDB Document ID format",
          }),
        quantity: z.number().min(1, "Quantity must be at least 1"),
      })
      .optional(),
    removeItem: z.string().optional(),
    addItem: z
      .object({
        product: z
          .any()
          .transform((val) =>
            val instanceof mongoose.Types.ObjectId ? val.toString() : val
          )
          .refine((val) => mongoose.Types.ObjectId.isValid(val), {
            message: "Invalid MongoDB Document ID format",
          }),
        quantity: z.number().min(1, "Quantity must be at least 1"),
      })
      .optional(),
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

    if (bodyValidation.data.item) {
      const updatedProductId = bodyValidation.data.item.product;

      order.items = order.items.map((item) => {
        if (item.product.toString() === updatedProductId) {
          return {
            ...item,
            quantity: bodyValidation.data.item?.quantity ?? item.quantity,
          };
        }
        return item;
      });
    }

    if (bodyValidation.data.removeItem) {
      order.items = order.items.filter(
        (item) => item.product.toString() !== bodyValidation.data.removeItem
      );
    }

    if (bodyValidation.data.addItem) {
      const { product, quantity } = bodyValidation.data.addItem;

      const existingItem = order.items.find(
        (item) => item.product.toString() === product
      );

      if (existingItem) {
        existingItem.quantity = quantity;
      } else {
        order.items.push({ product, quantity });
      }
    }

    if (bodyValidation.data.status) {
      order.status = bodyValidation.data.status;
    }
    if (bodyValidation.data.paymentStatus) {
      order.paymentStatus = bodyValidation.data.paymentStatus;
    }
    if (bodyValidation.data.deliveryAddress) {
      order.deliveryAddress = bodyValidation.data.deliveryAddress;
    }
    if (bodyValidation.data.amount) {
      order.amount = bodyValidation.data.amount;
    }

    // Update order only if data is provided
    // Object.assign(order, bodyValidation.data);

    // Save order
    const docs = await order.save();

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
          message: "Order not found with provided ID",
        },
      };
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
