import { Hono } from "hono";
import { customer } from "../controllers";
import { authorize, protect } from "../middlewares";
const customers = new Hono();

// Get All customers
customers.get("/", protect, authorize(["admin", "manager"]), (c) =>
  customer.getCustomers(c)
);

// Create new customer
customers.post(
  "/auth/register",
  protect,
  authorize(["admin", "manager"]),
  (c) => customer.registerCustomer(c)
);

// Send message to the customer with access key and their information
customers.post("/notification", protect, authorize(["admin"]), (c) =>
  customer.sendNotification(c)
);

// Regenerate Access Key
customers.post("/regenerate-access-key", protect, authorize(["admin"]), (c) =>
  customer.regenerateAccessKey(c)
);

// Customer access their own account with access key
customers.get("/access", (c) => customer.customerAccess(c));

// Get Single User
customers.get("/:id", protect, authorize(["admin", "manager"]), (c) =>
  customer.getSingleCustomer(c)
);

// Update User
customers.put("/:id", protect, authorize(["admin", "manager"]), (c) =>
  customer.updateCustomer(c)
);

// Delete User
customers.delete("/:id", protect, authorize(["admin"]), (c) =>
  customer.deleteCustomer(c)
);

export default customers;
