import { Hono } from "hono";
import { category } from "../controllers";
import { authorize, protect } from "../middlewares";

const categories = new Hono();

// Get All categories (Private)
categories.get("/", protect, (c) => category.getCategories(c));

// Create new category (Private)
categories.post("/register", protect, (c) => category.registerCategory(c));

// Get Single category (Private)
categories.get("/:id", protect, (c) => category.getSingleCategory(c));

// Update category (Private)
categories.put("/:id", protect, (c) => category.updateCategory(c));

// Delete category (Only can Super Admin)
categories.delete("/:id", protect, authorize(), (c) =>
  category.deleteCategory(c)
);

export default categories;
