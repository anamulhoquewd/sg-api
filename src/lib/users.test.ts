import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { sign, verify } from "hono/jwt";
import {
  uploadAvatar,
  generateS3AccessKey,
  generateAccessToken,
  generateRefreshToken,
  extractFilename,
} from "./users";
import { test, jest, describe, expect, beforeEach } from "@jest/globals";

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn(),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
}));

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(),
}));

jest.mock("hono/jwt", () => ({
  sign: jest.fn(),
}));

// Add this type
type MockResponse = {
  $metadata?: {};
};

describe("User Utility Functions", () => {
  // 🟢 Test Extract Filename
  test("extractFilename should extract correct filename from URL", () => {
    const url =
      "https://s3.amazonaws.com/test-bucket/uploads/avatars/sample-image.jpg?some-query";
    const extracted = extractFilename(url);
    expect(extracted).toBe("sample-image.jpg");
  });

  test("extractFilename should return null if no match is found", () => {
    const url =
      "https://s3.amazonaws.com/test-bucket/no-avatar/sample-image.jpg";
    const extracted = extractFilename(url);
    expect(extracted).toBeNull();
  });

  // 🟢 Test Generate Access Token
  test("should generate a valid access token", async () => {
    const mockUser = {
      _id: "12345",
      role: "user",
      email: "test@example.com",
    };

    const token = await generateAccessToken({ user: mockUser, expMinutes: 5 });

    expect(typeof token).toBe("string");
  });

  // 🟢 Test Generate Refresh Token
  //   test("generateRefreshToken should generate a valid refresh token", async () => {
  //     const userMock = { _id: "123", role: "admin", email: "test@example.com" };
  //     const token = await generateRefreshToken({ user: userMock });

  //     expect(typeof token).toBe("string");

  //     // Verify the token
  //     const decoded = await verify(
  //       token,
  //       process.env.JWT_SECRET || "jwt_refresh_token_secret"
  //     );
  //     expect(decoded).toMatchObject({
  //       id: "123",
  //       role: "admin",
  //       email: "test@example.com",
  //     });

  //     expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  //   });
});
