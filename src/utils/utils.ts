import { z } from "zod";
import mongoose from "mongoose";

// 🔹 Validate the ID (MongoDB ObjectId format)
const idSchema = z.object({
  id: z
    .any()
    .transform((val) =>
      val instanceof mongoose.Types.ObjectId ? val.toString() : val
    )
    .refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: "Invalid MongoDB Document ID format",
    }),
});

export default idSchema;
