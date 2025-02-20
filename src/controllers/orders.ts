import { Context } from "hono";
import { defaults } from "../config/defaults";
import { badRequestHandler, serverErrorHandler } from "../middlewares";
import {
  getOrdersService,
  getSingleOrderService,
  registerOrderService,
  updateOrderService,
  deleteOrderService,
} from "../services";

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

  const response = await getOrdersService({
    page,
    limit,
    search,
    sortBy,
    sortType,
    toDate,
    fromDate,
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

// 🔹 Create order
const registerOrder = async (c: Context) => {
  const body = await c.req.json();

  const response = await registerOrderService(body);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 201);
};

// 🔹 Get single order
const getSingleOrder = async (c: Context) => {
  const id = c.req.param("id");

  const response = await getSingleOrderService(id);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// 🔹 Update order
const updateOrder = async (c: Context) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const response = await updateOrderService({ id, body });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// 🔹 Delete order
const deleteOrder = async (c: Context) => {
  const id = c.req.param("id");

  const response = await deleteOrderService(id);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

export { getOrders, registerOrder, getSingleOrder, updateOrder, deleteOrder };
