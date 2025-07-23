import { Hono } from "hono";
import { payment } from "../controllers";
import { authorize, protect } from "../middlewares";

const payments = new Hono();

// payments.post("/initiate", async (c) => {
//   const body = await c.req.json();
//   const { amount, name, email, phone } = body;

//   const tran_id = `tran_${Date.now()}`;

//   const data = {
//     store_id: sslcommerz.store_id,
//     store_passwd: sslcommerz.store_passwd,
//     total_amount: amount,
//     currency: "BDT",
//     tran_id,
//     success_url: "http://localhost:3000/success",
//     fail_url: "http://localhost:3000/fail",
//     cancel_url: "http://localhost:3000/cancel",
//     ipn_url: "http://localhost:3000/ipn",
//     cus_name: name,
//     cus_email: email,
//     cus_phone: phone,
//     cus_add1: "Dhaka",
//     cus_city: "Dhaka",
//     cus_postcode: "1000",
//     cus_country: "Bangladesh",
//     shipping_method: "NO",
//     product_name: "Custom Product",
//     product_category: "General",
//     product_profile: "general",
//   };

//   try {
//     const apiUrl = `${sslcommerz.base_url}/gwprocess/v4/api.php`;

//     const response = await axios.post(apiUrl, data);
//     if (response.data.status === "SUCCESS") {
//       // Save transaction
//       await Payment.create({
//         tran_id,
//         amount,
//         customer: { name, email, phone },
//       });

//       return c.json({ url: response.data.GatewayPageURL });
//     } else {
//       return c.json({ error: "Payment init failed", data: response.data }, 400);
//     }
//   } catch (err: any) {
//     console.error(err.message);
//     return c.json({ error: "Internal Server Error" }, 500);
//   }
// });

// Make payment

payments.post("/initiate", (c) => payment.initiate(c));

// Get All payments (Only admin)
// payments.get("/", protect, authorize(), (c) => payment.getPayments(c));

// Count how many payment I have
// payments.get("/count", protect, authorize(), (c) => payment.getPaymentCount(c));

// Get Single payment (Only admin)
// payments.get("/:id", protect, authorize(), (c) => payment.getSinglePayment(c));

// Create payment (Private)
// payments.post("/", protect, (c) => payment.registerPayment(c));

// Update payment (Only admin)
// payments.put("/:id", protect, authorize(), (c) => payment.updatePayment(c));

// Delete payment (Only admin)
// payments.delete("/:id", protect, authorize(), (c) => payment.deletePayment(c));

export default payments;
