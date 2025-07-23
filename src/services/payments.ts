import { sslcommerz } from "../config/sslcommerz";
import SSLCommerzPayment from "sslcommerz-lts";

export const initiatePaymentService = async (body: any) => {
  const { amount, name, phone, address, city } = body;

  const tran_id = `tran_${Date.now()}`;

  console.log(sslcommerz);

  const data = {
    store_id: "anamu687f6df1c4d81",
    store_passwd: "anamu687f6df1c4d81@ssl",
    total_amount: amount,
    currency: "BDT",
    tran_id,
    success_url: "http://localhost:3001/success",
    fail_url: "http://localhost:3001/fail",
    cancel_url: "http://localhost:3001/cancel",
    ipn_url: "http://localhost:3001/ipn",
    cus_name: name,
    cus_email: "example@gmail.com",
    cus_phone: phone,
    cus_add1: address,
    cus_city: city,
    cus_postcode: "1000",
    cus_country: "Bangladesh",
    shipping_method: "NO",
    product_name: "Custom Product",
    product_category: "General",
    product_profile: "general",
  };

  try {
    // Initialize SSLCommerzPayment
    const sslcz = new SSLCommerzPayment(
      sslcommerz.store_id,
      sslcommerz.store_passwd,
      sslcommerz.is_live
    );
    const response = await sslcz.init(data);

    if (response.status === "SUCCESS") {
      // Save transaction
      return {
        success: {
          success: true,
          message: "Payments fetched successfully",
          data: response,
        },
      };
    } else {
      return {
        error: {
          message: "Payment init failed",
          data: response,
        },
      };
    }
  } catch (error: any) {
    return {
      serverError: {
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === "production" ? null : error.stack,
      },
    };
  }
};
