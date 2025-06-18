import { z } from "zod";
import { Category, Product } from "../models";
import { ProductDiscunt, productZodValidation } from "../models/Products";
import { schemaValidationError } from "./utile";
import { defaults } from "../config/defaults";
import { pagination } from "../lib";
import idSchema from "../utils/utils";
import { s3 } from "./../config/S3";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

const AWS_BUCKET_NAME = (process.env.AWS_BUCKET_NAME as string) || "bucket";
const AWS_REGION = (process.env.AWS_REGION as string) || "eu-north-1";
const AWS_ACCESS_KEY_ID = (process.env.AWS_ACCESS_KEY_ID as string) || "";
const AWS_SECRET_ACCESS_KEY =
  (process.env.AWS_SECRET_ACCESS_KEY as string) || "";

export const registerProductService = async (body: ProductDiscunt) => {
  // Validate the data
  const bodyValidation = productZodValidation
    .omit({ media: true })
    .safeParse(body);
  if (!bodyValidation.success) {
    return {
      error: schemaValidationError(
        bodyValidation.error,
        "Invalid request body"
      ),
    };
  }

  const {
    slug,
    name,
    title,
    shortDescription,
    longDescription,
    origin,
    lowStockThreshold,
    status,
    visibility,
    isPopular,
    category,
    unit: {
      originalPrice,
      unitType,
      stockQuantity,
      averageWeightPerFruit,
      costPerItem,
    },
    discount: { discountExp, discountType, discountValue } = {},
    season,
  } = bodyValidation.data;

  try {
    // Check if Product already exists
    const existingProduct = await Product.findOne({ slug });

    if (existingProduct) {
      return {
        error: {
          message: "Product already exists",
          fields: [
            {
              slug: "slug",
              message: "Slug must be unique",
            },
          ],
        },
      };
    }

    // Create new product
    const product = new Product({
      slug,
      lowStockThreshold,
      name,
      popular: isPopular,
      status,
      title,
      visibility,
      season,
      category,
      unit: {
        costPerItem,
        originalPrice,
        stockQuantity,
        unitType,
        averageWeightPerFruit,
      },
      longDescription,
      origin,
      shortDescription,
      ...(discountValue &&
        discountValue > 0 && {
          discount: {
            discountType,
            discountValue,
            discountExp,
          },
        }),
    });

    // Save product
    const docs = await product.save();

    // Response
    return {
      success: {
        success: true,
        message: "Product created successfully",
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

export const deleteMediaService = async ({
  body, //expects: ["https://ss.s3.e-7.amazonaws.com/products/801.jpeg"]
  id,
}: {
  body: { urls: string[] };
  id: string;
}) => {
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_BUCKET_NAME) {
    return {
      error: {
        message:
          "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY is missing in env variables",
      },
    };
  }

  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return {
      error: schemaValidationError(idValidation.error, "Invalid ID"),
    };
  }

  // Url validation with zod
  const urlSchema = z.object({
    urls: z.array(z.string()),
  });

  const fileValidation = urlSchema.safeParse({ urls: body.urls });
  if (!fileValidation.success) {
    return {
      error: schemaValidationError(
        fileValidation.error,
        "Invalid request body"
      ),
    };
  }

  try {
    const product = await Product.findById(idValidation.data.id);

    if (!product) {
      return {
        error: {
          message: "Product not found with the provided ID",
        },
      };
    }

    const keys = fileValidation.data.urls.map((key) => {
      return new URL(key).pathname.startsWith("/")
        ? new URL(key).pathname.slice(1) // "folder/image.jpg" (without the leading slash)
        : new URL(key).pathname;
    });

    const command = new DeleteObjectsCommand({
      Bucket: AWS_BUCKET_NAME,
      Delete: {
        Objects: keys.map((key) => ({ Key: key })),
        Quiet: false, // If true, no details are returned
      },
    });

    await s3.send(command);

    if (product) {
      product.media =
        product.media?.filter(
          (i) => !fileValidation.data.urls.includes(i.url)
        ) || [];
    }

    // Save updates
    const docs = await product.save();

    return {
      success: {
        success: true,
        message: "File deleted successfully",
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

export const includesMediaUrlsService = async ({
  id,
  body,
}: {
  id: string;
  body: { urls: string[] };
}) => {
  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return {
      error: schemaValidationError(idValidation.error, "Invalid ID"),
    };
  }

  const updateUnitValuidationWithZod = z.object({
    urls: z.array(z.string().url()),
  });

  // Validate the data
  const bodyValidation = updateUnitValuidationWithZod.partial().safeParse(body);
  if (!bodyValidation.success) {
    return {
      error: schemaValidationError(
        bodyValidation.error,
        "Invalid request body"
      ),
    };
  }

  try {
    // Check if product exists
    const product = await Product.findById(idValidation.data.id);

    if (!product) {
      return {
        error: {
          message: "Product not found with the provided ID",
        },
      };
    }

    // Check if any field is provided
    if (Object.keys(bodyValidation.data).length === 0) {
      return {
        success: {
          success: true,
          message: "No updates provided, returning existing product (unit)",
          data: product,
        },
      };
    }

    if (bodyValidation.data.urls) {
      const mediaItems = bodyValidation.data.urls.map((url) => ({
        url,
        alt: product.slug,
      }));
      product.media.push(...mediaItems);
    }
    const docs = await product.save();

    // Response
    return {
      success: {
        success: true,
        message: "Product (Unit) updated successfully",
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

export const uploadMediaService = async ({
  body,
  slug,
}: {
  body: any;
  slug: string;
}) => {
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_BUCKET_NAME) {
    return {
      error: {
        message:
          "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY is missing in env variables",
      },
    };
  }

  // Slug must be needed. Because I want to save each product's media with a different product storage.
  if (!slug) {
    return {
      error: { message: "Slug is required in query" },
    };
  }

  let media = body["media"];

  if (!media) {
    return {
      error: { message: "No file provided" },
    };
  }

  // Media validation with zod
  const mediaSchema = z.object({
    media: z
      .array(
        z
          .instanceof(File, { message: "Invalid file format" })
          .refine((file) => file.size <= 4 * 1024 * 1024, {
            message: "File size must be less than 4MB",
          })
          .refine(
            (file) =>
              ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(
                file.type
              ),
            {
              message: "Only JPG, JPEG, PNG and WEBP files are allowed",
            }
          )
      )
      .min(1, { message: "At least one file is required" }),
  });

  // Convert to arry if delete single file
  if (!Array.isArray(media)) {
    media = [media];
  }

  // Filter valid files
  media = media.filter((f: File) => f instanceof File && f !== undefined);

  const fileValidation = mediaSchema.safeParse({ media: media });
  if (!fileValidation.success) {
    return {
      error: schemaValidationError(
        fileValidation.error,
        "Invalid request body"
      ),
    };
  }

  // Generate filenames
  let filenames: string[] = [];
  media.map((file: File) =>
    filenames.push(
      `${file.name.split(".")[0].split(" ").join("-")}-${Date.now()}.jpeg`
    )
  );

  try {
    const uploadPromises = media.map(async (file: File, index: number) => {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const key = `products/${slug}/${filenames[index]}`;

      const params = {
        Bucket: AWS_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: "image/jpeg",
      };

      await s3.send(new PutObjectCommand(params));

      // Construct the public URL
      const imageUrl = `https://${AWS_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${key}`;
      return imageUrl;
    });

    const urls = await Promise.all(uploadPromises);

    return {
      success: {
        success: true,
        message: "Avatar updated successfully",
        data: urls,
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

export const getProductsService = async (queryParams: {
  page: number;
  limit: number;
  search: string;
  sortBy: string;
  sortType: string;
  popular: boolean | string;
  visibility: boolean | string;
  category: string;
  onlyDiscounted: string;
  status: string;
}) => {
  const {
    page,
    limit,
    search,
    sortBy,
    sortType,
    popular,
    visibility,
    category,
    onlyDiscounted,
    status,
  } = queryParams;

  // Validate query parameters
  const querySchema = z.object({
    sortBy: z.enum(["createdAt", "updatedAt", "name", "email"]).optional(),
    sortType: z
      .enum(["asc", "desc"])
      .default(defaults.sortType as "asc" | "desc"),
    search: z.string().optional(),
    category: z
      .string()
      // .length(24, { message: "Invalid category ID" })
      .regex(/^[a-fA-F0-9]{24}$/, { message: "Invalid ObjectId format" })
      .optional(),
    status: z.enum(["inStock", "lowStock", "outOfStock"]).optional(),
  });

  // Safe Parse for better error handling
  const queryValidation = querySchema.safeParse({
    search,
    sortBy,
    sortType,
    ...(category && { category }),
    ...(status && { status }),
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
    if (popular !== "") query.popular = popular;
    if (visibility !== "") query.visibility = visibility;
    if (category !== "") query.category = queryValidation.data.category;
    if (status !== "") query.status = queryValidation.data.status;
    if (onlyDiscounted === "true")
      query["discount.discountExp"] = { $gte: new Date() };

    if (queryValidation.data.search) {
      query.$or = [
        { slug: { $regex: queryValidation.data.search, $options: "i" } },
        { name: { $regex: queryValidation.data.search, $options: "i" } },
        { title: { $regex: queryValidation.data.search, $options: "i" } },
      ];
    }

    // Allowable sort fields
    const validSortFields = ["createdAt", "updatedAt", "name", "slug"];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortDirection =
      queryValidation.data.sortType.toLocaleLowerCase() === "asc" ? 1 : -1;

    // Fetch products
    const [products, total] = await Promise.all([
      Product.find(query)
        .sort({ [sortField]: sortDirection })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("category")
        .exec(),

      Product.countDocuments(query),
    ]);

    // Pagination
    const getPagination = pagination({
      page: page,
      limit: limit,
      total,
    });

    const finalProducts = products.map((product) => {
      const price = product.unit?.originalPrice ?? 0;
      let discountValue = product.discount?.discountValue ?? 0;
      const discountExp = product.discount?.discountExp;

      if (discountExp && new Date(discountExp) < new Date()) {
        discountValue = 0;
      }

      const discountType = product.discount?.discountType;

      const finalPrice =
        discountType === "percentage"
          ? price - (price * discountValue) / 100
          : price - discountValue;

      product.unit.price = finalPrice;

      return product;
    });

    return {
      success: {
        success: true,
        message: "Products fetched successfully",
        data: finalProducts,
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

export const getSingleProductSercive = async (slug: string) => {
  const querySchema = z.object({
    slug: z.string(),
  });

  const queryValidation = querySchema.safeParse({
    slug,
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
    // Check if product exists
    const product = await Product.findOne({ slug: queryValidation.data.slug })
      .populate("category")
      .exec();

    if (!product) {
      return {
        error: {
          message: "Product not found with the provided ID",
        },
      };
    }

    const price = product.unit?.originalPrice ?? 0;
    let discountValue = product.discount?.discountValue ?? 0;
    const discountExp = product.discount?.discountExp;

    if (discountExp && new Date(discountExp) < new Date()) {
      discountValue = 0;
    }

    const discountType = product.discount?.discountType;

    const finalPrice =
      discountType === "percentage"
        ? price - (price * discountValue) / 100
        : price - discountValue;

    product.unit.price = finalPrice;

    // Response
    return {
      success: {
        success: true,
        message: "Product fetched successfully",
        data: product,
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

interface UpdateUnitBody {
  status: "inStock" | "lowStock" | "outOfStock";
  lowStockThreshold: number;
  originalPrice: number;
  costPerItem: number;
  stockQuantity: number;
  averageWeightPerFruit: string;
  unitType: "kg" | "piece";
}

export const updateUnitService = async ({
  id,
  body,
}: {
  id: string;
  body: UpdateUnitBody;
}) => {
  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return {
      error: schemaValidationError(idValidation.error, "Invalid ID"),
    };
  }

  const updateUnitValuidationWithZod = z.object({
    status: z.enum(["inStock", "lowStock", "outOfStock"]).optional(),
    lowStockThreshold: z.number().optional(),
    originalPrice: z.number().optional(),
    costPerItem: z.number().optional(),
    stockQuantity: z.number().optional(),
    averageWeightPerFruit: z.string().optional(),
    unitType: z.enum(["kg", "piece"]).optional(),
  });

  // Validate the data
  const bodyValidation = updateUnitValuidationWithZod.safeParse(body);
  if (!bodyValidation.success) {
    return {
      error: schemaValidationError(
        bodyValidation.error,
        "Invalid request body"
      ),
    };
  }

  try {
    // Check if product exists
    const product = await Product.findById(idValidation.data.id);

    if (!product) {
      return {
        error: {
          message: "Product not found with the provided ID",
        },
      };
    }

    // Check if any field is provided
    if (Object.keys(bodyValidation.data).length === 0) {
      return {
        success: {
          success: true,
          message: "No updates provided, returning existing product (unit)",
          data: product,
        },
      };
    }

    // Update only provided fields
    if (bodyValidation.data.status) {
      product.status = bodyValidation.data.status;
    }
    if (bodyValidation.data.lowStockThreshold) {
      product.lowStockThreshold = bodyValidation.data.lowStockThreshold;
    }
    if (bodyValidation.data.originalPrice) {
      product.unit.originalPrice = bodyValidation.data.originalPrice;
    }
    if (bodyValidation.data.costPerItem) {
      product.unit.costPerItem = bodyValidation.data.costPerItem;
    }
    if (bodyValidation.data.stockQuantity) {
      product.unit.stockQuantity = bodyValidation.data.stockQuantity;
    }
    if (bodyValidation.data.unitType) {
      product.unit.unitType = bodyValidation.data.unitType;
    }
    if (bodyValidation.data.averageWeightPerFruit) {
      product.unit.averageWeightPerFruit =
        bodyValidation.data.averageWeightPerFruit;
    }

    const docs = await product.save();

    // Response
    return {
      success: {
        success: true,
        message: "Product (Unit) updated successfully",
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

interface UpdateDiscountBody {
  discountType: "flat" | "percentage";
  discountValue: number;
  discountExp: Date;
}

export const updateDiscountService = async ({
  id,
  body,
}: {
  id: string;
  body: UpdateDiscountBody;
}) => {
  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return {
      error: schemaValidationError(idValidation.error, "Invalid ID"),
    };
  }

  const updateUnitValuidationWithZod = z.object({
    discountType: z.enum(["flat", "percentage"]).optional(),
    discountValue: z.number().optional(),
    discountExp: z.date().optional(),
  });

  // Validate the data
  const bodyValidation = updateUnitValuidationWithZod.safeParse(body);
  if (!bodyValidation.success) {
    return {
      error: schemaValidationError(
        bodyValidation.error,
        "Invalid request body"
      ),
    };
  }

  try {
    // Check if product exists
    const product = await Product.findById(idValidation.data.id);

    if (!product) {
      return {
        error: {
          message: "Product not found with the provided ID",
        },
      };
    }

    // Check if any field is provided
    if (Object.keys(bodyValidation.data).length === 0) {
      return {
        success: {
          success: true,
          message: "No updates provided, returning existing product (discount)",
          data: product,
        },
      };
    }

    // Update only provided fields
    if (!product.discount) {
      product.discount = {
        discountType: "flat",
        discountValue: 0,
        discountExp: new Date(),
      };
    }

    const discount = product.discount!;

    if (bodyValidation.data.discountExp) {
      discount.discountExp = bodyValidation.data.discountExp;
    }
    if (bodyValidation.data.discountValue) {
      discount.discountValue = bodyValidation.data.discountValue;
    }
    if (bodyValidation.data.discountType) {
      discount.discountType = bodyValidation.data.discountType;
    }

    const docs = await product.save();

    // Response
    return {
      success: {
        success: true,
        message: "Product (Discount) updated successfully",
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

interface UpdateGeneralBody {
  name: string;
  title: string;
  shortDescription: string;
  longDescription: string;
}

export const updateGeneralService = async ({
  id,
  body,
}: {
  id: string;
  body: UpdateGeneralBody;
}) => {
  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return {
      error: schemaValidationError(idValidation.error, "Invalid ID"),
    };
  }

  const updateUnitValuidationWithZod = z.object({
    name: z.string().optional(),
    titel: z.string().optional(),
    shortDescription: z.string().optional(),
    longDescription: z.string().optional(),
  });

  // Validate the data
  const bodyValidation = updateUnitValuidationWithZod.partial().safeParse(body);
  if (!bodyValidation.success) {
    return {
      error: schemaValidationError(
        bodyValidation.error,
        "Invalid request body"
      ),
    };
  }

  try {
    // Check if product exists
    const product = await Product.findById(idValidation.data.id);

    if (!product) {
      return {
        error: {
          message: "Product not found with the provided ID",
        },
      };
    }

    // Check if any field is provided
    if (Object.keys(bodyValidation.data).length === 0) {
      return {
        success: {
          success: true,
          message: "No updates provided, returning existing product (general)",
          data: product,
        },
      };
    }

    // Update only provided fields
    Object.assign(product, bodyValidation.data);
    const docs = await product.save();

    // Response
    return {
      success: {
        success: true,
        message: "Product (General) updated successfully",
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

interface UpdateCategoryBody {
  category: string;
}

export const updateOnlyCategoryService = async ({
  id,
  body,
}: {
  id: string;
  body: UpdateCategoryBody;
}) => {
  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return {
      error: schemaValidationError(idValidation.error, "Invalid ID"),
    };
  }

  try {
    const categories = await Category.find();

    const updateUnitValuidationWithZod = z.object({
      category: z
        .enum(
          categories.map((category) => category._id.toString()) as [
            string,
            ...string[]
          ],
          { message: "Select valid category" }
        )
        .optional(),
    });

    // Validate the data
    const bodyValidation = updateUnitValuidationWithZod
      .partial()
      .safeParse(body);
    if (!bodyValidation.success) {
      return {
        error: schemaValidationError(
          bodyValidation.error,
          "Invalid request body"
        ),
      };
    }

    // Check if product exists
    const product = await Product.findById(idValidation.data.id);

    if (!product) {
      return {
        error: {
          message: "Product not found with the provided ID",
        },
      };
    }

    // Check if any field is provided
    if (Object.keys(bodyValidation.data).length === 0) {
      return {
        success: {
          success: true,
          message: "No updates provided, returning existing product (category)",
          data: product,
        },
      };
    }

    // Update only provided fields
    Object.assign(product, bodyValidation.data);
    const docs = await product.save();

    // Response
    return {
      success: {
        success: true,
        message: "Product (Category) updated successfully",
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

interface UpdateVisibilityBody {
  visibility: boolean;
  isPopular: boolean;
}

export const updateVisibilityService = async ({
  id,
  body,
}: {
  id: string;
  body: UpdateVisibilityBody;
}) => {
  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return {
      error: schemaValidationError(idValidation.error, "Invalid ID"),
    };
  }

  try {
    const updateUnitValuidationWithZod = z.object({
      visibility: z.boolean().optional(),
      isPopular: z.boolean().optional(),
    });

    // Validate the data
    const bodyValidation = updateUnitValuidationWithZod
      .partial()
      .safeParse(body);
    if (!bodyValidation.success) {
      return {
        error: schemaValidationError(
          bodyValidation.error,
          "Invalid request body"
        ),
      };
    }

    // Check if product exists
    const product = await Product.findById(idValidation.data.id);

    if (!product) {
      return {
        error: {
          message: "Product not found with the provided ID",
        },
      };
    }

    // Check if any field is provided
    if (Object.keys(bodyValidation.data).length === 0) {
      return {
        success: {
          success: true,
          message:
            "No updates provided, returning existing product (visibility)",
          data: product,
        },
      };
    }

    // Update only provided fields
    Object.assign(product, bodyValidation.data);
    const docs = await product.save();

    // Response
    return {
      success: {
        success: true,
        message: "Product (Visibility) updated successfully",
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

export const deleteProductService = async (id: string) => {
  // Validate ID
  const idValidation = idSchema.safeParse({ id });
  if (!idValidation.success) {
    return {
      error: schemaValidationError(idValidation.error, "Invalid ID"),
    };
  }

  try {
    // Check if product exists
    const product = await Product.findById(idValidation.data.id);
    if (!product) {
      return {
        error: {
          message: "Product not found with the provided ID",
        },
      };
    }

    const extractUrl =
      product?.media
        ?.map((item) => item?.url)
        .filter((url): url is string => !!url) || [];

    deleteMediaService({ body: { urls: extractUrl }, id });

    // Delete product
    await product.deleteOne();

    // Response
    return {
      success: {
        success: true,
        message: "Product deleted successfully",
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
