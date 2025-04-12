import { Hono } from "hono";
import { payment } from "../controllers";
import { authorize, protect } from "../middlewares";

const payments = new Hono();

// 🔹Get All payments (Only admin)
payments.get("/", protect, authorize(["admin"]), (c) => payment.getPayments(c));

// Count how many payment I have
payments.get("/count", protect, authorize(["admin"]), (c) =>
  payment.getPaymentCount(c)
);

// 🔹Get Single payment (Only admin)
payments.get("/:id", protect, authorize(["admin"]), (c) =>
  payment.getSinglePayment(c)
);

// 🔹Create payment (Private)
payments.post("/", protect, (c) => payment.registerPayment(c));

// 🔹Update payment (Only admin)
payments.put("/:id", protect, authorize(["admin"]), (c) =>
  payment.updatePayment(c)
);

// 🔹Delete payment (Only admin)
payments.delete("/:id", protect, authorize(["admin"]), (c) =>
  payment.deletePayment(c)
);

export default payments;
