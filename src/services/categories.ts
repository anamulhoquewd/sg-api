import { string, z } from "zod";
import { schemaValidationError } from "./utile";
import { Category } from "../models";
import { pagination } from "../lib";
import { defaults } from "../config/defaults";
import idSchema from "../controllers/utils";
import { CategoryDocument } from "../models/Categories";

export const registerCategoryService = async (body: CategoryDocument) => {
  // Validate Body
  const bodySchema = z.object({
    slug: z.string(),
    name: z.string(),
    shortDescription: z.string().max(200).optional(),
    longDescription: string().max(500).optional(),
  });

  // Safe Parse for better error handling
  const bodyValidation = bodySchema.safeParse(body);

  if (!bodyValidation.success) {
    return {
      error: schemaValidationError(
        bodyValidation.error,
        "Invalid request body"
      ),
    };
  }

  // Destructure Body
  const { slug, name, longDescription, shortDescription } = bodyValidation.data;

  try {
    // Check if category already exists
    const existingCategory = await Category.findOne({ slug });

    if (existingCategory) {
      return {
        error: {
          message: "This category already exists",
          fields: [
            {
              name: "slug",
              message: "Slug must be unique",
            },
          ],
        },
      };
    }

    // Create category
    const category = new Category({
      name,
      slug,
      shortDescription,
      longDescription,
    });

    // Save category
    const docs = await category.save();

    return {
      success: {
        success: true,
        message: "User created successfully",
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

export const getCategoryService = async (queryParams: {
  page: number;
  limit: number;
  search: string;
  sortBy: string;
  sortType: string;
}) => {
  const { page, limit, search, sortBy, sortType } = queryParams;

  // Validate query parameters
  const querySchema = z.object({
    sortBy: z.enum(["createdAt", "updatedAt", "name", "email"]).optional(),
    sortType: z
      .enum(["asc", "desc"])
      .default(defaults.sortType as "asc" | "desc"),
    search: z.string().optional(),
  });

  // Safe Parse for better error handling
  const queryValidation = querySchema.safeParse({
    search,
    sortBy,
    sortType,
  });

  // Return error if validation fails
  if (!queryValidation.success) {
    return {
      error: schemaValidationError(
        queryValidation.error,
        "Invalid query parameters"
      ),
    };
  }

  try {
    // Build query
    const query: any = {};
    if (queryValidation.data.search) {
      query.$or = [
        { name: { $regex: queryValidation.data.search, $options: "i" } },
        { slug: { $regex: queryValidation.data.search, $options: "i" } },
      ];
    }

    // Allowable sort fields
    const validSortFields = ["createdAt", "updatedAt", "name"];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortDirection =
      queryValidation.data.sortType.toLocaleLowerCase() === "asc" ? 1 : -1;

    // Fetch category
    const [categories, total] = await Promise.all([
      Category.find(query)
        .sort({ [sortField]: sortDirection })
        .skip((page - 1) * limit)
        .limit(limit),

      Category.countDocuments(query),
    ]);

    // Pagination
    const getPagination = pagination({
      page: page,
      limit: limit,
      total,
    });

    return {
      success: {
        success: true,
        message: "Categories fetched successfully",
        data: categories,
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

export const getSingleCategoryService = async (id: string) => {
  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return {
      error: schemaValidationError(idValidation.error, "Invalid Document ID"),
    };
  }

  try {
    // Check if category exists
    const category = await Category.findById(idValidation.data.id);

    if (!category) {
      return {
        error: {
          message: "Category not found with provided ID",
        },
      };
    }

    return {
      success: {
        success: true,
        message: "Category fetched successfully",
        data: category,
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

export const updateCategoryService = async ({
  body,
  id,
}: {
  body: CategoryDocument;
  id: string;
}) => {
  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return {
      error: schemaValidationError(idValidation.error, "Invalid Document ID"),
    };
  }

  // Validate Body
  const bodySchema = z.object({
    slug: z.string().optional(),
    name: z.string().optional(),
    shortDescription: z.string().max(200).optional(),
    longDescription: string().max(500).optional(),
  });

  // Validate Body
  const bodyValidation = bodySchema.safeParse(body);
  if (!bodyValidation.success) {
    return {
      error: schemaValidationError(
        bodyValidation.error,
        "Invalid request body"
      ),
    };
  }

  try {
    // Check if category exists
    const category = await Category.findById(idValidation.data.id);

    if (!category) {
      return {
        error: {
          message: "Category not found with the provided ID",
        },
      };
    }

    // Check if any field is provided
    if (Object.keys(bodyValidation.data).length === 0) {
      return {
        success: {
          success: true,
          message: "No updates provided, returning existing category",
          data: category,
        },
      };
    }

    // Update only provided fields
    Object.assign(category, bodyValidation.data);

    const docs = await category.save();

    return {
      success: {
        success: true,
        message: "Category updated successfully",
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

export const deleteCategoryService = async (id: string) => {
  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return { error: schemaValidationError(idValidation.error, "Invalid ID") };
  }

  try {
    // Delete category
    const category = await Category.findById(idValidation.data.id);

    if (!category) {
      return {
        error: {
          message: "Category not found with the provided ID",
        },
      };
    }

    // Delete user
    await category.deleteOne();

    // Response
    return {
      success: {
        success: true,
        message: "Category deleted successfully",
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
