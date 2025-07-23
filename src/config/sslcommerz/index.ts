import { config } from "dotenv";
config();

export const sslcommerz = {
  store_id: process.env.SSL_STORE_ID,
  store_passwd: process.env.SSL_STORE_PASSWD,
  is_live: process.env.SSL_IS_LIVE === "true",
  base_url: process.env.SSL_BASE_URL, // e.g., "https://sandbox.sslcommerz.com"
};
