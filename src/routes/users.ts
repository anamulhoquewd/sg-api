import { Hono } from "hono";
import { user } from "../controllers";
import { authorize, protect } from "../middlewares";

const users = new Hono();

// 🔹 Get All Users
users.get("/", protect, (c) => user.getUsers(c));

// 🔹 Create User (Only super admin)
users.post("/auth/register", protect, authorize(), (c) => user.registerUser(c));

// 🔹 Seed Admin User (On time)
users.post("/auth/super-admin", (c) => user.superAdmin(c));

// 🔹 Login User (Public)
users.post("/auth/login", (c) => user.loginUser(c));

// 🔹 Logout User (Private)
users.post("/auth/logout", protect, (c) => user.logout(c));

// 🔹 Refresh Token (Public)
users.post("/auth/refresh", (c) => user.refreshToken(c));

// 🔹 Change Password (Private)
users.patch(
  "/auth/change-password",
  protect,

  (c) => user.changePassword(c)
);

// 🔹 Forgot Password request (Public)
users.post("/auth/forgot-password", (c) => user.forgotPassword(c));

// 🔹 Reset Password (Public)
users.put("/auth/reset-password/:resetToken", (c) => user.resetPassword(c));

// 🔹 Get Single User (Private)
users.get("/:id", protect, (c) => user.getSingleUser(c));

// 🔹 Update User (Only Super Admin)
users.put("/:id", protect, authorize(), (c) => user.updateUser(c));

// 🔹 Update Profile (Private)
users.patch("/profile", protect, (c) => user.updateProfile(c));

// 🔹 Delete User (Only Super Admin)
users.delete("/:id", protect, authorize(), (c) => user.deleteUser(c));

// 🔹 Upload Profile Picture (Private)
users.post("/uploads-avatar", protect, (c) => user.changeAvatar(c));

export default users;
