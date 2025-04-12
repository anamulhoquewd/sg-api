import { Hono } from "hono";
import { customer } from "../controllers";
import { authorize, protect } from "../middlewares";
const customers = new Hono();

// 🔹 Get All customers (Private)
customers.get("/", protect, (c) => customer.getCustomers(c));

// 🔹 Count how many Customers I have.
customers.get("/count", protect, (c) => customer.getCustomerCount(c));

// 🔹 Get all customer's IDs.
customers.get("/ids", protect, (c) => customer.getCustomerIds(c));

// 🔹 Create new customer (Private)
customers.post("/auth/register", protect, (c) => customer.registerCustomer(c));

// 🔹 Send message to the customer with access key and their information (Only admin)
// customers.post("/notification", protect, authorize(["admin"]), (c) =>
//   customer.sendNotification(c)
// );

// Regenerate Access Key (Only admin)
customers.post("/regenerate-access-key", protect, authorize(["admin"]), (c) =>
  customer.regenerateAccessKey(c)
);

// 🔹 Customer access their own account with access key (public)
customers.get("/access", (c) => customer.customerAccess(c));

// 🔹 Get Single Customer (Private)
customers.get("/:id", protect, (c) => customer.getSingleCustomer(c));

// 🔹 Update Customer (Private)
customers.put("/:id", protect, (c) => customer.updateCustomer(c));

// 🔹 Delete Customer (Only admin)
customers.delete("/:id", protect, authorize(["admin"]), (c) =>
  customer.deleteCustomer(c)
);

export default customers;
