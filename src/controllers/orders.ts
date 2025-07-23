import { Context } from "hono";
import { defaults } from "../config/defaults";
import { badRequestHandler, serverErrorHandler } from "../middlewares";
import { ordersService } from "../services";

// et all orders
export const getOrders = async (c: Context) => {
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

  const response = await ordersService.getOrdersService({
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
export const registerOrder = async (c: Context) => {
  const body = await c.req.json();

  const response = await ordersService.registerOrderService(body);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 201);
};

// Get single order
export const getSingleOrder = async (c: Context) => {
  const id = c.req.param("id");

  const response = await ordersService.getSingleOrderService(id);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// Update order adjustment
export const updateOrderAdjustment = async (c: Context) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const response = await ordersService.updateOrderAdjustmentService({
    id,
    body,
  });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// Update order status
export const updateOrderStatus = async (c: Context) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const response = await ordersService.updateOrderStatueService({ id, body });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// Update order Items
export const updateOrderItems = async (c: Context) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const response = await ordersService.updateOrderItemsService({ id, body });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

// Delete order
export const deleteOrder = async (c: Context) => {
  const id = c.req.param("id");

  const response = await ordersService.deleteOrderService(id);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};
