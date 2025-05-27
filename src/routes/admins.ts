import { Hono } from "hono";
import { admin } from "../controllers";
import { authorize, protect } from "../middlewares";

const admins = new Hono();

// Get All admins (Private)
admins.get("/", protect, (c) => admin.getAdmins(c));

// Create admin (Only can super admin)
admins.post("/auth/register", protect, authorize(), (c) =>
  admin.registerAdmin(c)
);

// Login admin (Public)
admins.post("/auth/login", (c) => admin.loginAdmin(c));

// Logout admin (Private)
admins.post("/auth/logout", protect, (c) => admin.logout(c));

// Refresh Token (Public)
admins.post("/auth/refresh", (c) => admin.refreshToken(c));

// Change Password (Private)
admins.patch("/auth/change-password", protect, (c) => admin.changePassword(c));

// Forgot Password request (Public)
admins.post("/auth/forgot-password", (c) => admin.forgotPassword(c));

// Reset Password (Public)
admins.put("/auth/reset-password/:resetToken", (c) => admin.resetPassword(c));

// Get me
admins.get("/me", protect, (c) => admin.getMe(c));

// Update Profile (Private)
admins.patch("/me", protect, (c) => admin.updateMe(c));

// Upload Profile Picture (Private)
admins.post("/uploads", protect, (c) => admin.changeAvatar(c));

// Get Single admin (Private)
admins.get("/:id", protect, (c) => admin.getSingleAdmin(c));

// Delete admin (Only can Super Admin)
admins.delete("/:id", protect, authorize(), (c) => admin.deleteAdmin(c));

export default admins;
