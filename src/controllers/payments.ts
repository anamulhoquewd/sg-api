import { Context } from "hono";
import { Customer, Payment } from "../models";
import { defaults } from "../config/defaults";
import { pagination } from "../lib";
import { z } from "zod";
import mongoose from "mongoose";
import { badRequestHandler } from "../middlewares";
import idSchema from "./utils";

// Get all payments
const getPayments = async (c: Context) => {
  const page = parseInt(c.req.query("page") as string, 10) || defaults.page;
  const limit = parseInt(c.req.query("limit") as string, 10) || defaults.limit;
  const sortBy = c.req.query("sortBy") || defaults.sortBy;
  const sortType = c.req.query("sortType") || defaults.sortType;
  const customer = c.req.query("customer") || null;

  // Validate query parameters
  const querySchema = z.object({
    sortBy: z.string().optional().default(defaults.sortBy),
    sortType: z
      .enum(["asc", "desc"])
      .optional()
      .default(defaults.sortType as "asc" | "desc"),
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
    // Validate sort field
    const validSortFields = ["createdAt", "updatedAt", "amount"];
    const sortField = validSortFields.includes(queryValidation.data.sortBy)
      ? queryValidation.data.sortBy
      : "updatedAt";
    const sortDirection =
      queryValidation.data.sortType.toLocaleLowerCase() === "asc" ? 1 : -1;

    // Filter by customer ID
    const query = queryValidation.data.customer
      ? { customerId: queryValidation.data.customer }
      : {};

    // Fetch payments
    const payments = await Payment.find(query)
      .sort({ [sortField]: sortDirection })
      .skip((page - 1) * limit)
      .limit(limit);

    // Count total payments
    const totalPayments: number = await Payment.countDocuments(query);

    return c.json(
      {
        success: true,
        message: "Payments fetched successfully",
        data: payments,
        pagination: pagination({ page, limit, total: totalPayments }),
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

// Get single payment
const getSinglePayment = async (c: Context) => {
  const id = c.req.param("id");

  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return badRequestHandler(c, {
      msg: String(idValidation.error.issues[0].message),
    });
  }

  try {
    const payment = await Payment.findById(id);

    if (!payment) {
      return badRequestHandler(c, {
        msg: "Payment not found with provided ID",
      });
    }

    return c.json({
      success: true,
      message: "Payment fetched successfully",
      data: payment,
    });
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

// Register payment
const registerPayment = async (c: Context) => {
  const body = await c.req.json();

  const bodySchema = z
    .object({
      customerId: z
        .any()
        .transform((val) =>
          val instanceof mongoose.Types.ObjectId ? val.toString() : val
        )
        .refine((val) => mongoose.Types.ObjectId.isValid(val), {
          message: "Invalid MongoDB User ID format",
        }),
      amount: z.number().positive("Amount must be a positive number"),
      paymentMethod: z.enum(["bank", "bkash", "nagad", "cash"]),
      transactionId: z.string().optional(),
      bankName: z.string().optional(),
      bkashNumber: z.string().optional(),
      nagadNumber: z.string().optional(),
      cashReceivedBy: z.string().optional(),
      note: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.paymentMethod === "bank") {
        if (!data.transactionId) {
          ctx.addIssue({
            code: "custom",
            path: ["transactionId"],
            message: "Transaction ID is required for bank payment",
          });
        }
        if (!data.bankName) {
          ctx.addIssue({
            code: "custom",
            path: ["bankName"],
            message: "Bank name is required for bank payment",
          });
        }
      }

      if (data.paymentMethod === "bkash") {
        if (!data.transactionId) {
          ctx.addIssue({
            code: "custom",
            path: ["transactionId"],
            message: "Transaction ID is required for bkash payment",
          });
        }
        if (!data.bkashNumber) {
          ctx.addIssue({
            code: "custom",
            path: ["bkashNumber"],
            message: "Bkash number is required",
          });
        }
      }

      if (data.paymentMethod === "nagad") {
        if (!data.transactionId) {
          ctx.addIssue({
            code: "custom",
            path: ["transactionId"],
            message: "Transaction ID is required for nagad payment",
          });
        }
        if (!data.nagadNumber) {
          ctx.addIssue({
            code: "custom",
            path: ["nagadNumber"],
            message: "Nagad number is required",
          });
        }
      }

      if (data.paymentMethod === "cash" && !data.cashReceivedBy) {
        ctx.addIssue({
          code: "custom",
          path: ["cashReceivedBy"],
          message: "Cash received by is required",
        });
      }
    });

  // Safe Parse for better error handling
  const bodyValidation = bodySchema.safeParse(body);
  if (!bodyValidation.success) {
    return badRequestHandler(c, {
      msg: "Invalid request body",
      fields: bodyValidation.error.issues.map((issue) => ({
        name: String(issue.path[0]),
        message: issue.message,
      })),
    });
  }

  const {
    customerId,
    amount,
    paymentMethod,
    note,
    transactionId,
    bankName,
    bkashNumber,
    nagadNumber,
    cashReceivedBy,
  } = bodyValidation.data;

  try {
    const customer = await Customer.findById(customerId);

    if (!customer) {
      return badRequestHandler(c, {
        msg: "Customer not found with the provided ID",
      });
    }

    // Transaction details schema
    const transactionDetails: {
      bankName?: string;
      bkashNumber?: string;
      nagadNumber?: string;
      cashReceivedBy?: string;
      transactionId?: string;
    } = {};

    // Set transaction details based on payment method
    if (paymentMethod === "bank") {
      transactionDetails.bankName = bankName;
      transactionDetails.transactionId = transactionId;
    }
    if (paymentMethod === "bkash") {
      transactionDetails.bkashNumber = bkashNumber;
      transactionDetails.transactionId = transactionId;
    }
    if (paymentMethod === "nagad") {
      transactionDetails.nagadNumber = nagadNumber;
      transactionDetails.transactionId = transactionId;
    }
    if (paymentMethod === "cash") {
      transactionDetails.cashReceivedBy = cashReceivedBy;
    }

    // Register payment
    const payment = new Payment({
      customerId,
      amount,
      paymentMethod,
      note,
      transactionDetails,
    });

    // Save payment
    const docs = await payment.save();

    // Update customer amount
    customer.amount -= docs.amount;

    // Update customer payments status
    if (customer.amount === 0) {
      // Update customer payments status. if amount is 0 then paid
      customer.paymentStatus = "paid";
    } else if (customer.amount < 0) {
      // if amount is less than 0 then pending
      customer.paymentStatus = "pending";
    } else {
      // if amount is greater than 0 then partially paid
      customer.paymentStatus = "partially_paid";
    }

    // Save changes
    await customer.save();

    return c.json(
      {
        success: true,
        message: "Payment registered successfully",
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

// Update payment
const updatePayment = async (c: Context) => {
  const id = c.req.param("id");

  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return badRequestHandler(c, {
      msg: String(idValidation.error.issues[0].message),
    });
  }

  const body = await c.req.json();

  const bodySchema = z
    .object({
      amount: z
        .number()
        .positive("Amount must be a positive number")
        .optional(),
      note: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.amount && data.amount < 0) {
        ctx.addIssue({
          code: "custom",
          path: ["amount"],
          message: "Amount cannot be negative",
        });
      }
    });

  // Safe Parse for better error handling
  const bodyValidation = bodySchema.safeParse(body);
  if (!bodyValidation.success) {
    return badRequestHandler(c, {
      msg: "Invalid request body",
      fields: bodyValidation.error.issues.map((issue) => ({
        name: String(issue.path[0]),
        message: issue.message,
      })),
    });
  }

  try {
    const payment = await Payment.findById(idValidation.data.id);

    if (!payment) {
      return badRequestHandler(c, {
        msg: "Payment not found with provided ID",
      });
    }

    if (Object.keys(idValidation.data.id).length === 0) {
      return c.json(
        {
          success: true,
          error: {
            message: "No updates provided, returning existing payment",
            code: 400,
          },
          data: payment,
        },
        400
      );
    }

    // Get previous payment amount
    const prevAmount = payment.amount;

    // Update only provided fields
    Object.assign(payment, bodyValidation.data);
    const docs = await payment.save();

    // New payment amount after update
    const newAmount = docs.amount;

    // Update customer amount
    const customer = await Customer.findById(payment.customerId);

    if (customer) {
      // Adjust the customer's bill based on payment update
      customer.amount += prevAmount - newAmount;

      // Update customer payments status
      if (customer.amount === 0) {
        // Update customer payments status. if amount is 0 then paid
        customer.paymentStatus = "paid";
      } else if (customer.amount < 0) {
        // if amount is less than 0 then pending
        customer.paymentStatus = "pending";
      } else {
        // if amount is greater than 0 then partially paid
        customer.paymentStatus = "partially_paid";
      }

      // Save customer
      await customer.save();
    }

    return c.json(
      {
        success: true,
        message: "Payment updated successfully",
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

// Delete payment
const deletePayment = async (c: Context) => {
  const id = c.req.param("id");

  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return badRequestHandler(c, {
      msg: String(idValidation.error.issues[0].message),
    });
  }

  try {
    // Check if payment exists
    const payment = await Payment.findById(idValidation.data.id);

    // If payment not found then return error
    if (!payment) {
      return badRequestHandler(c, {
        msg: "Payment not found with provided ID",
      });
    }

    // Delete payment
    await payment.deleteOne();

    // Update customer amount
    const customer = await Customer.findById(payment.customerId);
    if (customer) {
      // Adjust the customer's bill
      customer.amount += payment.amount;

      // Update customer payments status
      if (customer.amount === 0) {
        // Update customer payments status. if amount is 0 then paid
        customer.paymentStatus = "paid";
      } else if (customer.amount < 0) {
        // if amount is less than 0 then pending
        customer.paymentStatus = "pending";
      } else {
        // if amount is greater than 0 then partially paid
        customer.paymentStatus = "partially_paid";
      }

      // Save customer
      await customer.save();
    }

    return c.json(
      {
        success: true,
        message: "Payment deleted successfully",
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

export {
  getPayments,
  getSinglePayment,
  registerPayment,
  updatePayment,
  deletePayment,
};
