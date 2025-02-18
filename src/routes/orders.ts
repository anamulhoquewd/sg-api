import { Hono } from "hono";
import { order } from "../controllers";
import { authorize, protect } from "../middlewares";
const orders = new Hono();

// Get All orders
orders.get("/", protect, authorize(["admin", "manager"]), (c) =>
  order.getOrders(c)
);

// Create User
orders.post("/", protect, authorize(["admin", "manager"]), (c) =>
  order.registerOrder(c)
);

// Get Single User
orders.get("/:id", protect, authorize(["admin", "manager"]), (c) =>
  order.getSingleOrder(c)
);

// Update User
orders.put("/:id", protect, authorize(["admin", "manager"]), (c) =>
  order.updateOrder(c)
);

// Delete User
orders.delete("/:id", protect, authorize(["admin"]), (c) =>
  order.deleteOrder(c)
);

export default orders;
