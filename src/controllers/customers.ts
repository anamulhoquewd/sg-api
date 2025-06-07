import { Context } from "hono";
import { defaults } from "../config/defaults";
import { badRequestHandler, serverErrorHandler } from "../middlewares";
import {
  deleteCustomerService,
  getCustomersService,
  getSingleCustomerService,
  registerCustomerService,
  updateCustomerService,
} from "../services";

// Get All customers
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

// Register new customer
const registerCustomer = async (c: Context) => {
  const body = await c.req.json();

  const response = await registerCustomerService(body);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 201);
};

// Get Single Customer
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

// Update Customer
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

// Delete Customer
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

export {
  getCustomers,
  registerCustomer,
  getSingleCustomer,
  updateCustomer,
  deleteCustomer,
};
