import { Context } from "hono";
import { badRequestHandler, serverErrorHandler } from "../middlewares";
import { productsService } from "../services";
import { defaults } from "../config/defaults";

// Register new customer
export const registerProduct = async (c: Context) => {
  const body = await c.req.json();

  const response = await productsService.registerProductService(body);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 201);
};

export const uploadMedia = async (c: Context) => {
  const body = await c.req.parseBody({ all: true });
  const slug = c.req.query("slug") || "";

  const response = await productsService.uploadMediaService({ body, slug });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

export const getProducts = async (c: Context) => {
  const page = parseInt(c.req.query("page") as string, 10) || defaults.page;
  const limit = parseInt(c.req.query("limit") as string, 10) || defaults.limit;
  const search = c.req.query("search") || defaults.search;
  const sortBy = c.req.query("sortBy") || defaults.sortBy;
  const sortType = c.req.query("sortType") || defaults.sortType;
  const isPopular = c.req.query("isPopular");
  const isVisible = c.req.query("isVisible");
  const status = c.req.query("status") || defaults.productStatus;
  const category = c.req.query("category") || "";

  const popularity =
    isPopular === "false" ? false : isPopular === "true" ? true : "";
  const visibility =
    isVisible === "false" ? false : isVisible === "true" ? true : "";

  const response = await productsService.getProductsService({
    page,
    limit,
    search,
    sortBy,
    sortType,
    popular: popularity,
    visibility,
    category,
    status,
  });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

export const getSingleProduct = async (c: Context) => {
  const slug = c.req.param("slug");

  const response = await productsService.getSingleProductSercive(slug);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

export const deleteProduct = async (c: Context) => {
  const id = c.req.param("id");

  const response = await productsService.deleteProductService(id);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

export const updateUnit = async (c: Context) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const response = await productsService.updateUnitService({ body, id });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

export const updateGeneral = async (c: Context) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const response = await productsService.updateGeneralService({ body, id });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

export const updateVisibility = async (c: Context) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const response = await productsService.updateVisibilityService({ body, id });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

export const includesMediaUrls = async (c: Context) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const response = await productsService.includesMediaUrlsService({ body, id });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

export const deleteMedia = async (c: Context) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const response = await productsService.deleteMediaService({ body, id });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

export const updateCategory = async (c: Context) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const response = await productsService.updateOnlyCategoryService({
    body,
    id,
  });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};
