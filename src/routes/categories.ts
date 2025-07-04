import { Hono } from "hono";
import { category } from "../controllers";
import { authorize, protect } from "../middlewares";

const categories = new Hono();

// Get All categories (Private)
categories.get("/", (c) => category.getCategories(c));

// Create new category (Private)
categories.post("/register", protect, (c) => category.registerCategory(c));

// Get Single category (Private)
// categories.get("/:id", protect, (c) => category.getSingleCategory(c));

// Upload category avatar (Private)
categories.post("/uploads", protect, (c) => category.changeCategoryAvatar(c));

// Update category (Private)
categories.put("/:id", protect, (c) => category.updateCategory(c));

// Delete category (Only can Super Admin)
categories.delete("/:id", protect, authorize(), (c) =>
  category.deleteCategory(c)
);

export default categories;
