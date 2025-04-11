import { Context } from "hono";
import { defaults } from "../config/defaults";
import { badRequestHandler, serverErrorHandler } from "../middlewares";
import {
  deletePaymentService,
  getPaymentsService,
  getSinglePaymentService,
  registerPaymentService,
  updatePaymentService,getPaymentCountService
} from "../services";

// 🔹 Get all payments
const getPayments = async (c: Context) => {
  const page = parseInt(c.req.query("page") as string, 10) || defaults.page;
  const limit = parseInt(c.req.query("limit") as string, 10) || defaults.limit;
  const sortBy = c.req.query("sortBy") || defaults.sortBy;
  const sortType = c.req.query("sortType") || defaults.sortType;
  const customer = c.req.query("customer") || null;

  const response = await getPaymentsService({
    page,
    limit,
    sortBy,
    sortType,
    customer,
  });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

const getPaymentCount = async (c: Context) => {
  const response = await getPaymentCountService();

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// 🔹 Get single payment
const getSinglePayment = async (c: Context) => {
  const id = c.req.param("id");

  const response = await getSinglePaymentService(id);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// 🔹 Register payment
const registerPayment = async (c: Context) => {
  const body = await c.req.json();

  const response = await registerPaymentService(body);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 201);
};

// 🔹 Update payment
const updatePayment = async (c: Context) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const response = await updatePaymentService({ id, body });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// 🔹 Delete payment
const deletePayment = async (c: Context) => {
  const id = c.req.param("id");

  const response = await deletePaymentService(id);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

export {
  getPayments,
  getSinglePayment,
  registerPayment,
  updatePayment,
  deletePayment,
  getPaymentCount,
};
