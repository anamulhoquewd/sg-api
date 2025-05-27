import { Context } from "hono";
import { badRequestHandler, serverErrorHandler } from "../middlewares";
import {
  getCategoryService,
  getSingleCategoryService,
  registerCategoryService,
  updateCategoryService,
  deleteCategoryService,
} from "../services";
import { defaults } from "../config/defaults";

const registerCategory = async (c: Context) => {
  const body = await c.req.json();

  const response = await registerCategoryService(body);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 201);
};

const getCategories = async (c: Context) => {
  const page = parseInt(c.req.query("page") as string, 10) || defaults.page;
  const limit = parseInt(c.req.query("limit") as string, 10) || defaults.limit;
  const search = c.req.query("search") || defaults.search;
  const sortBy = c.req.query("sortBy") || defaults.sortBy;
  const sortType = c.req.query("sortType") || defaults.sortType;

  const response = await getCategoryService({
    page,
    limit,
    search,
    sortBy,
    sortType,
  });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

const getSingleCategory = async (c: Context) => {
  const id = c.req.param("id");

  const response = await getSingleCategoryService(id);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

const updateCategory = async (c: Context) => {
  const body = await c.req.json();
  const id = c.req.param("id");

  const response = await updateCategoryService({ body, id });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

const deleteCategory = async (c: Context) => {
  const id = c.req.param("id");

  const response = await deleteCategoryService(id);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

export {
  registerCategory,
  getCategories,
  getSingleCategory,
  updateCategory,
  deleteCategory,
};
