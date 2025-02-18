import * as mongoose from "mongoose";

// 🔹 Connect to MongoDB
const connectDB = async () => {
  try {
    if (process.env.MONGO_CLUSTER_URI !== undefined) {
      const conn = await mongoose.connect(process.env.MONGO_CLUSTER_URI, {
        autoIndex: true,
      });
      console.log(`MongoDB Connected To: ${conn.connection.host}`);
    }
  } catch (err: any) {
    console.log("MongoDB Connection Error: ", err.message);
    process.exit(1);
  }
};

export default connectDB;
