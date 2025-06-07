import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "dotenv";

config();
// Upload Avatar to S3
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

const extractFilename = (url: string) => {
  const match = url.match(/uploads\/avatars\/([^?]+)/);
  return match ? match[1] : null;
};

export { uploadAvatar, extractFilename };
