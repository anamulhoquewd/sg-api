import { Context } from "hono";
import { Customer, } from "../models";
import { defaults } from "../config/defaults";
import twilio from "twilio";
import { z } from "zod";
import {
  badRequestHandler,
  serverErrorHandler,
} from "../middlewares";
import mongoose from "mongoose";
import {
  deleteCustomerService,
  getCustomersService,
  getSingleCustomerService,
  registerCustomerService,
  updateCustomerService,
  regenerateAccessKeyService,
  customerAccessService,
} from "../services";

// 🔹 Get All customers
const getCustomers = async (c: Context) => {
  const page = parseInt(c.req.query("page") as string, 10) || defaults.page;
  const limit = parseInt(c.req.query("limit") as string, 10) || defaults.limit;
  const search = c.req.query("search") || defaults.search;
  const sortBy = c.req.query("sortBy") || defaults.sortBy;
  const sortType = c.req.query("sortType") || defaults.sortType;

  const response = await getCustomersService({
    page,
    limit,
    sortType,
    sortBy,
    search,
  });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success);
};

// 🔹 Send message to the customer
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

// 🔹 Create Customer
const registerCustomer = async (c: Context) => {
  const body = await c.req.json();

  const response = await registerCustomerService(body);

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  return c.json(response.success, 201);
};

// 🔹 Get Single Customer
const getSingleCustomer = async (c: Context) => {
  const id = c.req.param("id");

  const response = await getSingleCustomerService(id);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// 🔹 Update Customer
const updateCustomer = async (c: Context) => {
  const id = c.req.param("id");

  const body = await c.req.json();

  const response = await updateCustomerService({ body, id });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// 🔹 Delete Customer
const deleteCustomer = async (c: Context) => {
  const id = c.req.param("id");

  const response = await deleteCustomerService(id);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// 🔹 Regenerate Access Key
const regenerateAccessKey = async (c: Context) => {
  const id = c.req.query("id");

  if (!id) {
    return badRequestHandler(c, {
      msg: "Invalid query parameters",
      fields: [
        {
          name: "id",
          message: "ID is required",
        },
      ],
    });
  }

  const response = await regenerateAccessKeyService(id);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 201);
};

// 🔹 Customer access their own account with access key
const customerAccess = async (c: Context) => {
  const pPage = parseInt(c.req.query("pPage") as string, 10) || defaults.page; // 🔹 p for payments
  const oPage = parseInt(c.req.query("oPage") as string, 10) || defaults.page; // 🔹 o for orders
  const limit = parseInt(c.req.query("limit") as string, 10) || defaults.limit;
  const sortBy = c.req.query("sortBy") || defaults.sortBy;
  const sortType = c.req.query("sortType") || defaults.sortType;
  const fromDate = c.req.query("fromDate") || null;
  const toDate = c.req.query("toDate") || null;

  // Access key
  const key = c.req.query("key");

  const response = await customerAccessService({
    key,
    queryParams: {
      pPage,
      oPage,
      limit,
      sortBy,
      sortType,
      fromDate,
      toDate,
    },
  });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
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
