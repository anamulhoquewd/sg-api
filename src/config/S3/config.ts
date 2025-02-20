const AWS_REGION = (process.env.AWS_REGION as string) || "us-east-1";
const AWS_ACCESS_KEY_ID =
  (process.env.AWS_ACCESS_KEY_ID as string) || "12345678";
const AWS_SECRET_ACCESS_KEY =
  (process.env.AWS_SECRET_ACCESS_KEY as string) || "12345678";
import { S3Client } from "@aws-sdk/client-s3";

// 🔹 Initialize S3 Client
const s3 = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

export default s3;
