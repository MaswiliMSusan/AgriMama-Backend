
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(password) {
  if (typeof password !== "string" || password.length < 12) {
    throw new Error("Password must contain at least 12 characters.");
  }

  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password, passwordHash) {
  if (!password || !passwordHash) {
    return false;
  }

  return bcrypt.compare(password, passwordHash);
}
