import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { sign } from "hono/jwt";
import { config } from "dotenv";

config();

const JWT_ACCESS_SECRET = (process.env.JWT_ACCESS_SECRET as string) || "access";
const JWT_REFRESH_SECRET =
  (process.env.JWT_REFRESH_SECRET as string) || "refresh";

// 🔹 Upload Avatar to S3
const uploadAvatar = async ({
  s3,
  file,
  filename,
  fileType = "image/jpeg",
  folder = "avatars",
  bucketName,
}: {
  s3: S3Client;
  file: File;
  filename: string;
  fileType?: string;
  folder?: string;
  bucketName?: string;
}) => {
  try {
    const arrayBuffer = await file.arrayBuffer(); // Convert file to Buffer
    const buffer = Buffer.from(arrayBuffer);

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: `uploads/${folder}/${filename}`, // Save inside an 'uploads/avatars' folder
      ContentType: fileType,
      Body: buffer,
    });

    await s3.send(command);
  } catch (error: any) {
    throw new Error(error);
  }
};

// 🔹 Generate Access Key for the access to the s3 bucket
const generateS3AccessKey = async ({
  filename,
  s3,
}: {
  filename: string;
  s3: S3Client;
}) => {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: `uploads/avatars/${filename}`,
    });

    return await getSignedUrl(s3, command, { expiresIn: 60 * 60 * 24 * 7 }); // Expiry set to 7 days
  } catch (error: any) {
    throw new Error(error);
  }
};

const extractFilename = (url: string) => {
  const match = url.match(/uploads\/avatars\/([^?]+)/);
  return match ? match[1] : null;
};

// 🔹 Generate Access Token
const generateAccessToken = async ({
  user,
  expMinutes = 5,
}: {
  user: any;
  expMinutes?: number;
}) => {
  const token = await sign(
    {
      id: user._id,
      role: user.role,
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + 60 * (expMinutes + 55),
      // exp: Math.floor(Date.now() / 1000) + 60,
    },
    JWT_ACCESS_SECRET
  );

  if (!token) {
    throw new Error("Token generated failed");
  }

  return token;
};

// 🔹 Generate Refresh Token
const generateRefreshToken = async ({
  user,
  expDays = 7,
}: {
  user: any;
  expDays?: number;
}) => {
  const token = await sign(
    {
      id: user._id,
      role: user.role,
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * expDays,
      // exp: Math.floor(Date.now() / 1000) + 60 * 2,
    },
    JWT_REFRESH_SECRET
  );

  if (!token) {
    throw new Error("Token generated failed");
  }
  return token;
};

export {
  uploadAvatar,
  generateS3AccessKey,
  generateAccessToken,
  generateRefreshToken,
  extractFilename,
};
