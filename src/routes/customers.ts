import { Hono } from "hono";
import { customer } from "../controllers";
import { authorize, protect } from "../middlewares";

const customers = new Hono();

// Get All customers (Private)
customers.get("/", protect, (c) => customer.getCustomers(c));

// Register new customer (Privet) - for test
// customers.post("/", protect, (c) => customer.registerCustomer(c));

// Get Single Customer (Private)
// customers.get("/:id", protect, (c) => customer.getSingleCustomer(c));

// Update Customer (Private)
customers.put("/:id", protect, (c) => customer.updateCustomer(c));

// Delete Customer (Only can Super Admin)
customers.delete("/:id", protect, authorize(), (c) =>
  customer.deleteCustomer(c)
);

export default customers;
