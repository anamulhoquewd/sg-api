import { Context } from "hono";
import {
  authenticationError,
  badRequestHandler,
  serverErrorHandler,
} from "../middlewares";
import {
  getCategoryService,
  getSingleCategoryService,
  registerCategoryService,
  updateCategoryService,
  deleteCategoryService,
  uploadSingleFile,
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

// Change Category Avatar
const changeCategoryAvatar = async (c: Context) => {
  const body = await c.req.parseBody();
  const categoryId = c.req.query("categoryId");
  const file = body["avatar"] as File;

  // Get category from category id in the query params
  if (!categoryId) {
    return badRequestHandler(c, {
      message: "Category ID is required",
    });
  }

  const categoryResponse = await getSingleCategoryService(categoryId);

  if (categoryResponse.error) {
    return badRequestHandler(c, categoryResponse.error);
  }

  if (categoryResponse.serverError) {
    return serverErrorHandler(c, categoryResponse.serverError);
  }

  // Generate filename
  const fileN = c.req.query("filename") || "avatar";
  const filename = `${fileN}-${Date.now()}.webp`;

  const response = await uploadSingleFile({
    body: { avatar: file },
    filename,
    collection: categoryResponse.success.data,
    folder: "categories",
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
  registerCategory,
  getCategories,
  getSingleCategory,
  updateCategory,
  deleteCategory,
  changeCategoryAvatar,
};
