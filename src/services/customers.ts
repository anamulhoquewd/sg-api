import { z } from "zod";
import { defaults } from "../config/defaults";
import { Customer, Order, Payment } from "../models";
import { pagination } from "../lib";
import idSchema from "../utils/utils";
import { schemaValidationError } from "./utile";
import { CustomerDocument, customerZodValidation } from "../models/Customers";

export const getCustomersService = async (queryParams: {
  page: number;
  limit: number;
  search: string;
  sortType: string;
  sortBy: string;
}) => {
  const { sortBy, sortType, page, limit, search } = queryParams;
  const querySchema = z.object({
    sortBy: z
      .enum(["createdAt", "updatedAt", "name"])
      .optional()
      .default(defaults.sortBy as "createdAt" | "updatedAt" | "name"),
    sortType: z
      .enum(["asc", "desc"])
      .optional()
      .default(defaults.sortType as "asc" | "desc"),
  });

  const queryValidation = querySchema.safeParse({
    sortBy,
    sortType,
  });

  if (!queryValidation.success) {
    return {
      error: schemaValidationError(
        queryValidation.error,
        "Invalid query params"
      ),
    };
  }

  const query: any = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }

  const validSortFields = ["createdAt", "updatedAt", "name"];
  const sortField = validSortFields.includes(queryValidation.data.sortBy)
    ? queryValidation.data.sortBy
    : "createdAt";
  const sortDirection =
    queryValidation.data.sortType.toLocaleLowerCase() === "asc" ? 1 : -1;

  try {
    const [customers, total] = await Promise.all([
      Customer.find(query)
        .sort({ [sortField]: sortDirection })
        .skip((page - 1) * limit)
        .limit(limit),

      Customer.countDocuments(query),
    ]);

    const getPagination = pagination({
      page,
      limit,
      total,
    });

    return {
      success: {
        success: true,
        message: "Customers fetched successfully",
        data: customers,
        pagination: getPagination,
      },
    };
  } catch (error: any) {
    return {
      serverError: {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
    };
  }
};

export const registerCustomerService = async (body: {
  name: string;
  phone: string;
  address: string;
}) => {
  // Validate the data
  const bodyValidation = customerZodValidation.safeParse(body);
  if (!bodyValidation.success) {
    return {
      error: schemaValidationError(
        bodyValidation.error,
        "Invalid request body"
      ),
    };
  }

  const { name, phone, address } = bodyValidation.data;

  try {
    // Check if customer already exists
    const existingCustomer = await Customer.findOne({ phone }).select("phone");

    if (existingCustomer) {
      return {
        error: {
          message: "Customer already exists",
          fields: [
            {
              name: "phone",
              message: "Phone number must be unique",
            },
          ],
        },
      };
    }

    // Create new customer
    const customer = new Customer({
      name,
      phone,
      address,
    });

    // Save customer
    const docs = await customer.save();

    // Response
    return {
      success: {
        success: true,
        message: "Customer created successfully",
        data: docs,
      },
    };
  } catch (error: any) {
    return {
      serverError: {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
    };
  }
};

export const getSingleCustomerService = async (id: string) => {
  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return {
      error: schemaValidationError(idValidation.error, "Invalid ID"),
    };
  }

  try {
    // Check if customer exists
    const customer = await Customer.findById(idValidation.data.id);

    if (!customer) {
      return {
        error: {
          message: "Customer not found with the provided ID",
        },
      };
    }

    // Response
    return {
      success: {
        success: true,
        message: "Customer fetched successfully",
        data: customer,
      },
    };
  } catch (error: any) {
    return {
      serverError: {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
    };
  }
};

export const updateCustomerService = async ({
  body,
  id,
}: {
  id: string;
  body: CustomerDocument;
}) => {
  //  Validate the data
  const customerSchemaZod = z.object({
    name: z.string().min(3).max(50).optional(),
    phone: z
      .string()
      .regex(
        /^01\d{9}$/,
        "Phone number must start with 01 and be exactly 11 digits"
      )
      .optional(),
    address: z.string().max(100).optional(),
  });

  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return {
      error: schemaValidationError(idValidation.error, "Invalid ID"),
    };
  }

  // Validate the data
  const bodyValidation = customerSchemaZod.safeParse(body);
  if (!bodyValidation.success) {
    return {
      error: schemaValidationError(
        bodyValidation.error,
        "Invalid request body"
      ),
    };
  }

  try {
    // Check if customer exists
    const customer = await Customer.findById(idValidation.data.id);

    if (!customer) {
      return {
        error: {
          message: "Customer not found with the provided ID",
        },
      };
    }

    // Check if any field is provided
    if (Object.keys(bodyValidation.data).length === 0) {
      return {
        success: {
          success: true,
          message: "No updates provided, returning existing customer",
          data: customer,
        },
      };
    }

    // Update only provided fields
    Object.assign(customer, bodyValidation.data);
    const docs = await customer.save();

    // Response
    return {
      success: {
        success: true,
        message: "Customer updated successfully",
        data: docs,
      },
    };
  } catch (error: any) {
    return {
      serverError: {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
    };
  }
};

export const deleteCustomerService = async (id: string) => {
  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return {
      error: schemaValidationError(idValidation.error, "Invalid ID"),
    };
  }

  try {
    // Check if customer exists
    const customer = await Customer.findById(idValidation.data.id);
    if (!customer) {
      return {
        error: {
          message: "Customer not found with the provided ID",
        },
      };
    }

    // Delete customer
    await customer.deleteOne();

    // Response
    return {
      success: {
        success: true,
        message: "Customer deleted successfully",
      },
    };
  } catch (error: any) {
    return {
      serverError: {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
    };
  }
};
