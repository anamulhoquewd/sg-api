import mongoose from "mongoose";
import { pagination } from "../lib";
import { Customer, Payment } from "../models";
import { z } from "zod";
import { defaults } from "../config/defaults";
import idSchema from "../controllers/utils";
import { schemaValidationError } from "./utile";

export const getPaymentsService = async (queryParams: {
  page: number;
  limit: number;
  sortBy: string;
  sortType: string;
  customer: string | null;
}) => {
  const { page, limit, sortBy, sortType, customer } = queryParams;
  // Validate query parameters
  const querySchema = z.object({
    sortBy: z
      .enum(["createdAt", "updatedAt", "amount"])
      .optional()
      .default(defaults.sortBy as "createdAt" | "updatedAt" | "amount"),
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
    return {
      error: schemaValidationError(
        queryValidation.error,
        "Invalid query parameters"
      ),
    };
  }

  try {
    // Validate sort field
    const validSortFields = ["createdAt", "updatedAt", "amount"];
    const sortField = validSortFields.includes(queryValidation.data.sortBy)
      ? queryValidation.data.sortBy
      : "createdAt";
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

    const getPagination = pagination({ page, limit, total: totalPayments });

    // Response
    return {
      success: {
        success: true,
        message: "Payments fetched successfully",
        data: payments,
        pagination: getPagination,
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

export const getSinglePaymentService = async (id: string) => {
  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return { error: schemaValidationError(idValidation.error, "Invalid ID") };
  }

  try {
    // Check if payment exists
    const payment = await Payment.findById(id);

    if (!payment) {
      return {
        error: {
          msg: "Payment not found with provided ID",
        },
      };
    }

    // Response
    return {
      success: {
        success: true,
        message: "Payment fetched successfully",
        data: payment,
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

export const updatePaymentService = async ({
  id,
  body,
}: {
  id: string;
  body: { amount: number; note: string };
}) => {
  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return { error: schemaValidationError(idValidation.error, "Invalid ID") };
  }

  // Validate the data
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
    return {
      error: schemaValidationError(
        bodyValidation.error,
        "Invalid request body"
      ),
    };
  }

  try {
    // Check if payment exists
    const payment = await Payment.findById(idValidation.data.id);

    if (!payment) {
      return {
        error: {
          msg: "Payment not found with provided ID",
        },
      };
    }

    // Check if no updates are provided
    if (Object.keys(idValidation.data.id).length === 0) {
      return {
        success: {
          success: true,
          message: "No updates provided, returning existing payment",
          data: payment,
        },
      };
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

    // Response
    return {
      success: {
        success: true,
        message: "Payment updated successfully",
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

export const registerPaymentService = async (body: {
  customerId: string;
  amount: number;
  paymentMethod: "bank" | "bkash" | "nagad" | "cash";
  transactionId?: string;
  bankName?: string;
  bkashNumber?: string;
  nagadNumber?: string;
  cashReceivedBy?: string;
  note?: string;
}) => {
  // Validate the data
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
    return {
      error: schemaValidationError(
        bodyValidation.error,
        "Invalid request body"
      ),
    };
  }

  // Destructure the data
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
    // Check if customer exists
    const customer = await Customer.findById(customerId);

    if (!customer) {
      return {
        error: {
          msg: "Customer not found with the provided ID",
        },
      };
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

    // Response
    return {
      success: {
        success: true,
        message: "Payment registered successfully",
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

export const deletePaymentService = async (id: string) => {
  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return { error: schemaValidationError(idValidation.error, "Invalid ID") };
  }

  try {
    // Check if payment exists
    const payment = await Payment.findById(idValidation.data.id);

    // If payment not found then return error
    if (!payment) {
      return {
        error: {
          msg: "Payment not found with provided ID",
        },
      };
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

    // Response
    return {
      success: {
        success: true,
        message: "Payment deleted successfully",
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
