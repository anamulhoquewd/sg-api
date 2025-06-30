import { Context } from "hono";
import { defaults } from "../config/defaults";
import { badRequestHandler, serverErrorHandler } from "../middlewares";
import {
  getOrdersService,
  getSingleOrderService,
  registerOrderService,
  deleteOrderService,
  updateOrderAdjustmentService,
  updateOrderStatueService,
  updateOrderItemsService,
} from "../services";

// et all orders
const getOrders = async (c: Context) => {
  const page = parseInt(c.req.query("page") as string, 10) || defaults.page;
  const limit = parseInt(c.req.query("limit") as string, 10) || defaults.limit;
  const sortBy = c.req.query("sortBy") || defaults.sortBy;
  const sortType = c.req.query("sortType") || defaults.sortType;

  const fromDate = c.req.query("fromDate") ?? undefined;
  const toDate = c.req.query("toDate") ?? undefined;
  const date = c.req.query("date") ?? undefined;

  const customer = c.req.query("customer")?.trim() || undefined;
  const product = c.req.query("product")?.trim() || undefined;

  const search = c.req.query("search") || "";

  const status = c.req.query("status")?.trim() as
    | "pending"
    | "processing"
    | "shipped"
    | "delivered"
    | "cancelled"
    | "all"
    | undefined;
  const paymentStatus = c.req.query("paymentStatus")?.trim() as
    | "paid"
    | "unpaid"
    | "all"
    | undefined;

  const maxAmountRaw = c.req.query("maxAmount");
  const minAmountRaw = c.req.query("minAmount");

  const amountRange = {
    min:
      minAmountRaw && !isNaN(Number(minAmountRaw))
        ? Number(minAmountRaw)
        : undefined,
    max:
      maxAmountRaw && !isNaN(Number(maxAmountRaw))
        ? Number(maxAmountRaw)
        : undefined,
  };

  const dateRange = {
    from: fromDate,
    to: toDate,
  };

  const response = await getOrdersService({
    page,
    limit,
    sortBy,
    sortType,
    dateRange,
    date,
    customer,
    product,
    search,
    paymentStatus: paymentStatus === "all" ? undefined : paymentStatus,
    status: status === "all" ? undefined : status,
    amountRange,
  });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// Create order
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

// Get single order
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

// Update order adjustment
const updateOrderAdjustment = async (c: Context) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const response = await updateOrderAdjustmentService({ id, body });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// Update order status
const updateOrderStatus = async (c: Context) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const response = await updateOrderStatueService({ id, body });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// Update order Items
const updateOrderItems = async (c: Context) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const response = await updateOrderItemsService({ id, body });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// Delete order
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

export {
  getOrders,
  registerOrder,
  getSingleOrder,
  updateOrderAdjustment,
  deleteOrder,
  updateOrderItems,
  updateOrderStatus,
};
