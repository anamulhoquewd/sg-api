import { Hono } from "hono";
import { user } from "../controllers";
import { authorize, protect } from "../middlewares";

const users = new Hono();

// Get All Users
users.get("/", protect, authorize(["admin", "manager"]), (c) =>
  user.getUsers(c)
);

// Create User
users.post("/auth/register", protect, authorize(), (c) => user.registerUser(c));

// Seed Admin User
users.post("/auth/super-admin", (c) => user.superAdmin(c));

// Login User
users.post("/auth/login", (c) => user.loginUser(c));

// Logout User
users.post("/auth/logout", protect, (c) => user.logout(c));

// Refresh Token
users.post("/auth/refresh", (c) => user.refreshToken(c));

// Change Password
users.patch(
  "/auth/change-password",
  protect,
  authorize(["manager", "admin"]),
  (c) => user.changePassword(c)
);

// Forgot Password request
users.post("/auth/forgot-password", (c) => user.forgotPassword(c));

// Reset Password
users.put("/auth/reset-password/:resetToken", (c) => user.resetPassword(c));

// Get Single User
users.get("/:id", protect, authorize(["admin", "manager"]), (c) =>
  user.getSingleUser(c)
);

// Update User (Only Super Admin)
users.put("/:id", protect, authorize(), (c) => user.updateUser(c));

// Update Profile
users.patch("/profile", protect, authorize(["manager", "admin"]), (c) =>
  user.updateProfile(c)
);

// Delete User (Only Super Admin)
users.delete("/:id", protect, authorize(), (c) => user.deleteUser(c));

// Upload Profile Picture
users.post("/uploads-avatar", protect, authorize(["manager", "admin"]), (c) =>
  user.changeAvatar(c)
);

export default users;
