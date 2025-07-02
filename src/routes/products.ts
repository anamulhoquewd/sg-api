import { Hono } from "hono";
import { product } from "../controllers";
import { authorize, protect } from "../middlewares";

const products = new Hono();

// Get all Products (Public)
products.get("/", (c) => product.getProducts(c));

// Registar new products (Private)
products.post("/register", protect, (c) => product.registerProduct(c));

// Upload media (Private)
products.post("/media", protect, (c) => product.uploadMedia(c));

// Get single product (Public)
products.get("/:slug", (c) => product.getSingleProduct(c));

// Delete media (Private)
products.delete("/:id/media", protect, (c) => product.deleteMedia(c));

// Update product units (Private)
products.patch("/:id/unit", protect, (c) => product.updateUnit(c));

// Update product category (Private)
products.patch("/:id/category", protect, (c) => product.updateCategory(c));

// Update product general (Private)
products.patch("/:id/general", protect, (c) => product.updateGeneral(c));

// Update product visibility (Private)
products.patch("/:id/visibility", protect, (c) => product.updateVisibility(c));

// Update product media (Private)
products.patch("/:id/media", protect, (c) => product.includesMediaUrls(c));

// Delete product (Private)
products.delete("/:id", protect, authorize(), (c) => product.deleteProduct(c));

export default products;
