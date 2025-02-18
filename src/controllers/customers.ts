import { Context } from "hono";
import { Customer, Order, Payment } from "../models";
import { defaults } from "../config/defaults";
import { pagination } from "../lib";
import twilio from "twilio";
import { z } from "zod";
import { badRequestHandler, conflictHandler } from "../middlewares";
import mongoose from "mongoose";
import idSchema from "./utils";

// Get All customers
const getCustomers = async (c: Context) => {
  const page = parseInt(c.req.query("page") as string, 10) || defaults.page;
  const limit = parseInt(c.req.query("limit") as string, 10) || defaults.limit;
  const search = c.req.query("search") || defaults.search;
  const sortBy = c.req.query("sortBy") || defaults.sortBy;
  const sortType = c.req.query("sortType") || defaults.sortType;

  const querySchema = z.object({
    sortBy: z.string().optional().default(defaults.sortBy),
    sortType: z
      .enum(["asc", "desc"])
      .optional()
      .default(defaults.sortType as "asc" | "desc"),
  });

  const queryValidation = querySchema.safeParse({
    sortBy,
    sortType,
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

  const query: any = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }

  const validSortFields = ["createdAt", "updatedAt", "name"];
  const sortField = validSortFields.includes(queryValidation.data.sortBy)
    ? queryValidation.data.sortBy
    : "updatedAt";
  const sortDirection =
    queryValidation.data.sortType.toLocaleLowerCase() === "asc" ? 1 : -1;

  try {
    const users = await Customer.find(query)
      .sort({ [sortField]: sortDirection })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-accessKey -accessKeyExpiredAt");

    const totalCustomers = await Customer.countDocuments(query);

    return c.json(
      {
        success: true,
        message: "Users fetched successfully",
        data: users,
        pagination: pagination({ page, limit, total: totalCustomers }),
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

// Send message to the customer
// @TODO: Orders and paid amount should be sent from the backend.
const sendNotification = async (c: Context) => {
  const body = await c.req.json();

  const bodySchema = z.object({
    customerId: z
      .string()
      .refine((val) => mongoose.Types.ObjectId.isValid(val), {
        message: "Invalid MongoDB User ID format",
      }),
    orders: z.number(),
    paid: z.number(),
  });

  const bodyValidation = bodySchema.safeParse(body);

  if (!bodyValidation.success) {
    return badRequestHandler(c, {
      msg: "Invalid query parameters",
      fields: bodyValidation.error.issues.map((issue) => ({
        name: String(issue.path[0]),
        message: issue.message,
      })),
    });
  }

  const { customerId, orders, paid } = bodyValidation.data;

  try {
    const customer = await Customer.findById(customerId).select(
      "phone name accessKey amount"
    );

    if (!customer) {
      return c.json(
        {
          success: false,
          error: {
            message: "Customer not found",
            code: 404,
          },
        },
        404
      );
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    const client = new twilio.Twilio(accountSid, authToken);

    const messageBody = `Dear ${
      customer.name
    }, Your monthly summary: - **Total Orders Placed:** ${orders}- **Total Amount:** ${
      customer.amount
    } - **Total Paid:** ${paid} - **Outstanding Dues:** ${
      customer.amount
    }. For details, log in to your account "${`http://localhost:3000/api/v1/customers/access?key=${customer.accessKey}`}" or contact us. Thank you for choosing JolChowki Catering Service!`;

    client.messages
      .create({
        body: messageBody,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: `+880${customer.phone}`,
      })
      .then((message) => console.log(message.sid))
      .catch((error) => console.log(error));

    const newMessage = {
      message: messageBody,
      createdAt: new Date(),
      name: customer.name,
      phone: customer.phone,
      accessKey: customer.accessKey,
      link: `http://localhost:3000/api/v1/customers/access?key=${customer.accessKey}`,
    };

    return c.json(
      {
        success: true,
        message: "Message sent successfully",
        data: newMessage,
      },
      200
    );
  } catch (error: any) {
    throw new Error(error);
  }
};

// Create Customer
const registerCustomer = async (c: Context) => {
  const body = await c.req.json();

  // Validate the data
  const bodySchema = z
    .object({
      name: z.string().min(3).max(50),
      phone: z
        .string()
        .regex(
          /^01\d{9}$/,
          "Phone number must start with 01 and be exactly 11 digits"
        ),
      address: z.string().max(100),
      defaultItem: z.enum(["lunch", "dinner", "lunch&dinner"]),
      defaultPrice: z.number(),
      defaultQuantity: z.number(),
      paymentSystem: z.enum(["weekly", "monthly"]),
      defaultOffDays: z.array(z.string()),
    })
    .refine(
      (data) =>
        data.defaultOffDays?.every((day) =>
          ["sa", "su", "mo", "tu", "we", "th", "fr"].includes(day)
        ) ?? true,
      {
        message:
          "Default off days must be in the following order: sa, su, mo, tu, we, th, fr",
        path: ["defaultOffDays"],
      }
    );

  const bodyValidation = bodySchema.safeParse(body);
  if (!bodyValidation.success) {
    return badRequestHandler(c, {
      msg: "Invalid data",
      fields: bodyValidation.error.issues.map((issue) => ({
        name: String(issue.path[0]),
        message: issue.message,
      })),
    });
  }

  const {
    name,
    phone,
    address,
    defaultItem,
    defaultPrice,
    defaultQuantity,
    paymentSystem,
    defaultOffDays,
  } = bodyValidation.data;

  try {
    // Check if customer already exists
    const existingCustomer = await Customer.findOne({ phone }).select("phone");

    if (existingCustomer) {
      return conflictHandler(c, {
        msg: "Customer already exists",
        fields: [
          {
            name: "phone",
            message: "Phone number must be unique",
          },
        ],
      });
    }

    // Create new customer
    const customer = new Customer({
      name,
      phone,
      address,
      defaultItem,
      defaultPrice,
      defaultQuantity,
      paymentSystem,
      defaultOffDays,
    });

    // Generate and hash access key
    const accessKey = customer.generateAccessKey(60);

    // Save customer
    const docs = await customer.save();

    return c.json(
      {
        success: true,
        message: "Customer created successfully",
        data: docs,
        accessKey,
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

// Get Single Customer
const getSingleCustomer = async (c: Context) => {
  const id = c.req.param("id");

  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return badRequestHandler(c, {
      msg: String(idValidation.error.issues[0].message),
    });
  }

  try {
    const customer = await Customer.findById(idValidation.data.id);

    if (!customer) {
      return badRequestHandler(c, {
        msg: "Customer not found with the provided ID",
      });
    }

    return c.json(
      {
        success: true,
        message: "Customer fetched successfully",
        data: customer,
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

// Update Customer
const updateCustomer = async (c: Context) => {
  const id = c.req.param("id");

  const body = await c.req.json();

  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return badRequestHandler(c, {
      msg: String(idValidation.error.issues[0].message),
    });
  }

  // Validate the data
  const bodySchema = z
    .object({
      name: z.string().min(3).max(50).optional(),
      phone: z
        .string()
        .regex(
          /^01\d{9}$/,
          "Phone number must start with 01 and be exactly 11 digits"
        )
        .optional(),
      address: z.string().max(100).optional(),
      defaultItem: z.enum(["lunch", "dinner", "lunch&dinner"]).optional(),
      defaultPrice: z.number().optional(),
      defaultQuantity: z.number().optional(),
      paymentSystem: z.enum(["weekly", "monthly"]).optional(),
      defaultOffDays: z
        .array(z.enum(["sa", "su", "mo", "tu", "we", "th", "fr"]))
        .nonempty(),
    })
    .refine(
      (data) =>
        data.defaultOffDays?.every((day) =>
          ["sa", "su", "mo", "tu", "we", "th", "fr"].includes(day)
        ) ?? true,
      {
        message:
          "Default off days must be in the following order: sa, su, mo, tu, we, th, fr",
        path: ["defaultOffDays"],
      }
    );

  const bodyValidation = bodySchema.safeParse(body);
  if (!bodyValidation.success) {
    return badRequestHandler(c, {
      msg: "Invalid data",
      fields: bodyValidation.error.issues.map((issue) => ({
        name: String(issue.path[0]),
        message: issue.message,
      })),
    });
  }

  try {
    const customer = await Customer.findById(idValidation.data.id);

    if (!customer) {
      return badRequestHandler(c, {
        msg: "Customer not found with the provided ID",
      });
    }

    if (Object.keys(bodyValidation.data).length === 0) {
      return c.json(
        {
          success: false,
          error: {
            message: "No updates provided, returning existing customer",
            code: 400,
          },
          data: customer,
        },
        400
      );
    }

    // Update only provided fields
    Object.assign(customer, bodyValidation.data);
    const docs = await customer.save();

    return c.json(
      {
        success: true,
        message: "Customer updated successfully",
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

// Delete Customer
const deleteCustomer = async (c: Context) => {
  const id = c.req.param("id");

  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return badRequestHandler(c, {
      msg: String(idValidation.error.issues[0].message),
    });
  }

  try {
    const customer = await Customer.findById(idValidation.data.id);
    if (!customer) {
      return badRequestHandler(c, {
        msg: "Customer not found with the provided ID",
      });
    }

    await customer.deleteOne();

    return c.json(
      {
        success: true,
        message: "Customer deleted successfully",
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

// Regenerate Access Key
const regenerateAccessKey = async (c: Context) => {
  const id = c.req.query("id");

  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return badRequestHandler(c, {
      msg: String(idValidation.error.issues[0].message),
    });
  }

  try {
    const customer = await Customer.findById(idValidation.data.id);

    // Check if customer exists
    if (!customer) {
      return badRequestHandler(c, {
        msg: "Customer not found with the provided ID/Key",
      });
    }

    // Generate and hash access key. and save finally
    const reGenerateAccessKey = customer.generateAccessKey();
    await customer.save();

    return c.json(
      {
        success: true,
        message: "Access key regenerated successfully",
        accessKey: reGenerateAccessKey,
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

// Customer access their own account with access key
const customerAccess = async (c: Context) => {
  const pPage = parseInt(c.req.query("pPage") as string, 10) || defaults.page; // p for payments
  const oPage = parseInt(c.req.query("oPage") as string, 10) || defaults.page; // o for orders
  const limit = parseInt(c.req.query("limit") as string, 10) || defaults.limit;
  const sortBy = c.req.query("sortBy") || defaults.sortBy;
  const sortType = c.req.query("sortType") || defaults.sortType;
  const fromDate = c.req.query("fromDate") || null;
  const toDate = c.req.query("toDate") || null;

  const key = c.req.query("key");

  // Validate key
  const keySchema = z.object({
    key: z.string().refine((val) => val.length === 64, {
      message: "Invalid access key format",
    }),
  });

  const keyValidation = keySchema.safeParse({ key });
  if (!keyValidation.success) {
    console.log(keyValidation.error);
    return badRequestHandler(c, {
      msg: "Validation error",
      fields: keyValidation.error.issues.map((issue) => ({
        name: "key",
        message: issue.message,
      })),
    });
  }

  const querySchema = z.object({
    sortBy: z.string().optional().default(defaults.sortBy),
    sortType: z
      .enum(["asc", "desc"])
      .optional()
      .default(defaults.sortType as "asc" | "desc"),
  });

  // Validate query
  const queryValidation = querySchema.safeParse({
    sortBy,
    sortType,
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
    // Check if access key is valid
    const customer = await Customer.findOne({
      accessKey: keyValidation.data.key,
      accessKeyExpiredAt: { $gt: Date.now() }, // Must be greater than the current time
    });

    // Check if customer exists
    if (!customer) {
      return badRequestHandler(c, {
        msg: "Access key is not valid. Please request for a new key.",
      });
    }

    // Validate sort field
    const validSortFields = ["createdAt", "updatedAt"];
    const sortField = validSortFields.includes(queryValidation.data.sortBy)
      ? queryValidation.data.sortBy
      : "updatedAt";
    const sortDirection =
      queryValidation.data.sortType.toLocaleLowerCase() === "asc" ? 1 : -1;

    // Validate date range
    const dateFilter: any = {};
    if (fromDate && toDate) {
      dateFilter.$gte = new Date(fromDate);
      dateFilter.$lte = new Date(toDate);
    }

    // Query for orders
    const orderQuery = {
      customerId: customer._id,
      ...(fromDate && toDate ? { date: dateFilter } : {}), // sort by date range
    };

    // Query for payments
    const paymentQuery = {
      customerId: customer._id,
      ...(fromDate && toDate ? { updatedAt: dateFilter } : {}), // sort by date range
    };

    // Get orders
    const orders = await Order.find(orderQuery)
      .sort({ [sortField]: sortDirection })
      .skip((oPage - 1) * limit)
      .limit(limit);

    // Get total orders count
    const totalOrders = await Order.countDocuments(orderQuery);

    // Get payments
    const payments = await Payment.find(paymentQuery)
      .sort({ [sortField]: sortDirection })
      .skip((pPage - 1) * limit)
      .limit(limit);

    // Get total payments count
    const totalPayments = await Payment.countDocuments(paymentQuery);

    // Calculate total payment pages
    const totalPaymentPages = Math.ceil(totalPayments / limit);

    return c.json(
      {
        success: true,
        message: "Customer fetched successfully",
        data: {
          self: customer,
          orders: {
            data: orders,
            pagination: pagination({ page: oPage, limit, total: totalOrders }),
          },
          payments: {
            data: payments,
            pagination: pagination({
              page: pPage,
              limit,
              total: totalPaymentPages,
            }),
          },
        },
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
  getCustomers,
  registerCustomer,
  getSingleCustomer,
  updateCustomer,
  deleteCustomer,
  regenerateAccessKey,
  customerAccess,
  sendNotification,
};
