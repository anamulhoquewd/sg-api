import { Hono } from "hono";
import { product } from "../controllers";

const products = new Hono();

// Get all Products (Public)
products.get("/", (c) => product.getProducts(c));

// Registar new products (Private)
products.post("/register", (c) => product.registerProduct(c));

// Upload media (Private)
products.post("/media", (c) => product.uploadMedia(c));

// Get single product (Public)
products.get("/:slug", (c) => product.getSingleProduct(c));

// Delete media (Private)
products.delete("/:id/media", (c) => product.deleteMedia(c));

// Update product units (Private)
products.patch("/:id/unit", (c) => product.updateUnit(c));

// Update product category (Private)
products.patch("/:id/category", (c) => product.updateCategory(c));

// Update product discount (Private)
products.patch("/:id/discount", (c) => product.updateDiscount(c));

// Update product general (Private)
products.patch("/:id/general", (c) => product.updateGeneral(c));

// Update product visibility (Private)
products.patch("/:id/visibility", (c) => product.updateVisibility(c));

// Update product media (Private)
products.patch("/:id/media", (c) => product.includesMediaUrls(c));

// Delete product (Private)
products.delete("/:id", (c) => product.deleteProduct(c));

export default products;
