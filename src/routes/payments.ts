import { Hono } from "hono";
import { payment } from "../controllers";
import { authorize, protect } from "../middlewares";

const payments = new Hono();

// Get All payments
payments.get("/", protect, authorize(["admin"]), (c) => payment.getPayments(c));

// Get Single payment
payments.get("/:id", protect, authorize(["admin"]), (c) =>
  payment.getSinglePayment(c)
);

// Create payment
payments.post("/", protect, authorize(["admin", "manager"]), (c) =>
  payment.registerPayment(c)
);

// Update payment
payments.put("/:id", protect, authorize(["admin"]), (c) =>
  payment.updatePayment(c)
);

// Delete payment
payments.delete("/:id", protect, authorize(["admin"]), (c) =>
  payment.deletePayment(c)
);

export default payments;
