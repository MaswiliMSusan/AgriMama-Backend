
import "dotenv/config";

import sequelize from "../src/config/database.js";
import { User } from "../src/models/index.js";
import { hashPassword } from "../src/services/auth/passwordService.js";

async function createAdmin() {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error(
      "ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD are required."
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Please provide a valid email address.");
  }

  if (password.length < 12) {
    throw new Error("Admin password must contain at least 12 characters.");
  }

  await sequelize.authenticate();

  const existingUser = await User.findOne({
    where: { email },
  });

  if (existingUser) {
    throw new Error(
      "An account with this email already exists. No account was changed."
    );
  }

  const passwordHash = await hashPassword(password);

  const admin = await User.create({
    name,
    email,
    passwordHash,
    role: "admin",
    isActive: true,
  });

  console.log("Administrator account created successfully.");
  console.log({
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
  });
}

try {
  await createAdmin();
} catch (error) {
  console.error("Administrator provisioning failed:", error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
