
import crypto from "node:crypto";
import { Op } from "sequelize";
import { AuthSession } from "../../models/index.js";

const SESSION_DURATION_DAYS = 7;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
  );

  await AuthSession.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });

  return { token, expiresAt };
}

export async function findSession(token) {
  if (!token) return null;

  return AuthSession.findOne({
    where: {
      tokenHash: hashToken(token),
      revokedAt: null,
      expiresAt: { [Op.gt]: new Date() },
    },
    include: [{ association: "user" }],
  });
}

export async function revokeSession(token) {
  if (!token) return;

  await AuthSession.update(
    { revokedAt: new Date() },
    {
      where: {
        tokenHash: hashToken(token),
        revokedAt: null,
      },
    }
  );
}
