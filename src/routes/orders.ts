import { Hono } from "hono";
import { order } from "../controllers";
import { authorize, protect } from "../middlewares";
const orders = new Hono();

// Get All orders (Private)
orders.get("/", (c) => order.getOrders(c));

// Create Order (Public)
orders.post("/", (c) => order.registerOrder(c));

// Get Single Order (Private)
orders.get("/:id", (c) => order.getSingleOrder(c));

// Update Order (Private)
orders.patch("/:id", (c) => order.updateOrder(c));

// Delete Order (Private)
orders.delete("/:id", (c) => order.deleteOrder(c));

export default orders;
