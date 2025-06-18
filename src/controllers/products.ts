import { Context } from "hono";
import { badRequestHandler, serverErrorHandler } from "../middlewares";
import {
  getSingleProductSercive,
  registerProductService,
  deleteProductService,
  uploadMediaService,
  updateUnitService,
  updateGeneralService,
  updateVisibilityService,
  updateOnlyCategoryService,
  deleteMediaService,
  includesMediaUrlsService,
  updateDiscountService,
} from "../services";
import { getProductsService } from "../services";
import { defaults } from "../config/defaults";

// Register new customer
const registerProduct = async (c: Context) => {
  const body = await c.req.json();

  const response = await registerProductService(body);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 201);
};

const uploadMedia = async (c: Context) => {
  const body = await c.req.parseBody({ all: true });
  const slug = c.req.query("slug") || "";

  const response = await uploadMediaService({ body, slug });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

const getProducts = async (c: Context) => {
  const page = parseInt(c.req.query("page") as string, 10) || defaults.page;
  const limit = parseInt(c.req.query("limit") as string, 10) || defaults.limit;
  const search = c.req.query("search") || defaults.search;
  const sortBy = c.req.query("sortBy") || defaults.sortBy;
  const sortType = c.req.query("sortType") || defaults.sortType;
  const isPopular = c.req.query("isPopular");
  const isVisible = c.req.query("isVisible");
  const status = c.req.query("status") || defaults.productStatus;
  const category = c.req.query("category") || "";
  const onlyDiscounted = c.req.query("onlyDiscounted");

  const popularity =
    isPopular === "false" ? false : isPopular === "true" ? true : "";
  const visibility =
    isVisible === "false" ? false : isVisible === "true" ? true : "";

  const response = await getProductsService({
    page,
    limit,
    search,
    sortBy,
    sortType,
    popular: popularity,
    visibility,
    onlyDiscounted: onlyDiscounted || "",
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

const getSingleProduct = async (c: Context) => {
  const slug = c.req.param("slug");

  const response = await getSingleProductSercive(slug);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

const deleteProduct = async (c: Context) => {
  const id = c.req.param("id");

  const response = await deleteProductService(id);

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

const updateUnit = async (c: Context) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const response = await updateUnitService({ body, id });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

const updateDiscount = async (c: Context) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const response = await updateDiscountService({ body, id });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

const updateGeneral = async (c: Context) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const response = await updateGeneralService({ body, id });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

const updateVisibility = async (c: Context) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const response = await updateVisibilityService({ body, id });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

const includesMediaUrls = async (c: Context) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const response = await includesMediaUrlsService({ body, id });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

const deleteMedia = async (c: Context) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const response = await deleteMediaService({ body, id });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

const updateCategory = async (c: Context) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const response = await updateOnlyCategoryService({ body, id });

  if (response.error) {
    return badRequestHandler(c, response.error);
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 200);
};

export {
  registerProduct,
  getProducts,
  getSingleProduct,
  deleteProduct,
  uploadMedia,
  updateUnit,
  updateDiscount,
  updateCategory,
  updateGeneral,
  updateVisibility,
  includesMediaUrls,
  deleteMedia,
};
