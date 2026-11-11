
import "dotenv/config";

import sequelize from "../src/config/database.js";
import { User } from "../src/models/index.js";
import { hashPassword } from "../src/services/auth/passwordService.js";

try {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
  }

  if (password.length < 12) {
    throw new Error("Password must contain at least 12 characters.");
  }

  await sequelize.authenticate();

  const admin = await User.findOne({
    where: {
      email,
      role: "admin",
    },
  });

  if (!admin) {
    throw new Error("Administrator account not found.");
  }

  const passwordHash = await hashPassword(password);

  await admin.update({
    passwordHash,
    isActive: true,
  });

  console.log("Administrator password reset successfully.");
  console.log({
    id: admin.id,
    email: admin.email,
    role: admin.role,
  });
} catch (error) {
  console.error("Password reset failed:", error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
