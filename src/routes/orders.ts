import { Hono } from "hono";
import { order } from "../controllers";
import { authorize, protect } from "../middlewares";
const orders = new Hono();

// Get All orders (Private)
orders.get("/", protect, (c) => order.getOrders(c));

// Create Order (Private)
orders.post("/", (c) => order.registerOrder(c));

// Get Single Order (Private)
orders.get("/:id", protect, (c) => order.getSingleOrder(c));

// Update Order (Private)
orders.put("/:id", protect, (c) => order.updateOrder(c));

// Delete Order (Only admin)
orders.delete("/:id", protect, authorize(), (c) => order.deleteOrder(c));

export default orders;
