import { Hono } from "hono";
import { category } from "../controllers";
import { authorize, protect } from "../middlewares";

const categories = new Hono();

// Get All categories (Private)
categories.get("/", (c) => category.getCategories(c));

// Create new category (Private)
categories.post("/register", (c) => category.registerCategory(c));

// Get Single category (Private)
categories.get("/:id", (c) => category.getSingleCategory(c));

// Update category (Private)
categories.put("/:id", (c) => category.updateCategory(c));

// Delete category (Only can Super Admin)
categories.delete("/:id", (c) => category.deleteCategory(c));

export default categories;
