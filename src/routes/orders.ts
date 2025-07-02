import { Hono } from "hono";
import { order } from "../controllers";
import { authorize, protect } from "../middlewares";
const orders = new Hono();

// Get All orders (Private)
orders.get("/", protect, (c) => order.getOrders(c));

// Create Order (Public)
orders.post("/", (c) => order.registerOrder(c));

// Get Single Order (Private)
// orders.get("/:id", protect, (c) => order.getSingleOrder(c));

// Update Order status (Private)
orders.patch("/:id/status", protect, (c) => order.updateOrderStatus(c));

// Update Order adjustment (Private)
orders.patch("/:id/adjustment", protect, (c) => order.updateOrderAdjustment(c));

// Update Order items (Private)
orders.patch("/:id/items", protect, (c) => order.updateOrderItems(c));

// Delete Order (Private)
orders.delete("/:id", protect, authorize(), (c) => order.deleteOrder(c));

export default orders;
