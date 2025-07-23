import { Context } from "hono";
import { defaults } from "../config/defaults";
import { badRequestHandler, serverErrorHandler } from "../middlewares";
import { paymentsService } from "../services";

// Make payment
export const initiate = async (c: Context) => {
  const body = await c.req.json();

  const response = await paymentsService.initiatePaymentService(body);

  if (response.error) {
    return c.json(
      {
        success: false,
        error: {
          message: response.error.message,
          code: 400,
        },
        data: response.error.data,
      },
      400
    );
  }

  if (response.serverError) {
    return serverErrorHandler(c, response.serverError);
  }

  return c.json(response.success, 201);
};

// Get all payments
// export const getPayments = async (c: Context) => {
//   const page = parseInt(c.req.query("page") as string, 10) || defaults.page;
//   const limit = parseInt(c.req.query("limit") as string, 10) || defaults.limit;
//   const sortBy = c.req.query("sortBy") || defaults.sortBy;
//   const sortType = c.req.query("sortType") || defaults.sortType;
//   const customer = c.req.query("customer") || null;

//   const response = await paymentsService.getPaymentsService({
//     page,
//     limit,
//     sortBy,
//     sortType,
//     customer,
//   });

//   if (response.error) {
//     return badRequestHandler(c, response.error);
//   }

//   if (response.serverError) {
//     return serverErrorHandler(c, response.serverError);
//   }

//   return c.json(response.success, 200);
// };

// export const getPaymentCount = async (c: Context) => {
//   const response = await paymentsService.getPaymentCountService();

//   if (response.serverError) {
//     return serverErrorHandler(c, response.serverError);
//   }

//   return c.json(response.success, 200);
// };

// Get single payment
// export const getSinglePayment = async (c: Context) => {
//   const id = c.req.param("id");

//   const response = await paymentsService.getSinglePaymentService(id);

//   if (response.error) {
//     return badRequestHandler(c, response.error);
//   }

//   if (response.serverError) {
//     return serverErrorHandler(c, response.serverError);
//   }

//   return c.json(response.success, 200);
// };

// Register payment
// export const registerPayment = async (c: Context) => {
//   const body = await c.req.json();

//   const response = await paymentsService.registerPaymentService(body);

//   if (response.error) {
//     return badRequestHandler(c, response.error);
//   }

//   if (response.serverError) {
//     return serverErrorHandler(c, response.serverError);
//   }

//   return c.json(response.success, 201);
// };

// Update payment
// export const updatePayment = async (c: Context) => {
//   const id = c.req.param("id");
//   const body = await c.req.json();

//   const response = await paymentsService.updatePaymentService({ id, body });

//   if (response.error) {
//     return badRequestHandler(c, response.error);
//   }

//   if (response.serverError) {
//     return serverErrorHandler(c, response.serverError);
//   }

//   return c.json(response.success, 200);
// };

// Delete payment
// export const deletePayment = async (c: Context) => {
//   const id = c.req.param("id");

//   const response = await paymentsService.deletePaymentService(id);

//   if (response.error) {
//     return badRequestHandler(c, response.error);
//   }

//   if (response.serverError) {
//     return serverErrorHandler(c, response.serverError);
//   }

//   return c.json(response.success, 200);
// };
