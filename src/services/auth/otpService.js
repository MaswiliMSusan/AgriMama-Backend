
import crypto from "node:crypto";
import { Op } from "sequelize";
import { AuthOtp } from "../../models/index.js";

const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 5;

function validateOtpSecret() {
  if (!process.env.OTP_SECRET || process.env.OTP_SECRET.length < 32) {
    throw new Error(
      "OTP_SECRET must be configured with at least 32 characters."
    );
  }
}

function hashOtp(phone, otp) {
  validateOtpSecret();

  return crypto
    .createHmac("sha256", process.env.OTP_SECRET)
    .update(`${phone}:${otp}`)
    .digest("hex");
}

export async function generateOtp(phone) {
  validateOtpSecret();

  const otp = crypto.randomInt(100000, 1000000).toString();

  // Invalidate previous unused OTPs.
  await AuthOtp.update(
    { consumedAt: new Date() },
    {
      where: {
        phone,
        consumedAt: null,
      },
    }
  );

  const expiresAt = new Date(
    Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
  );

  await AuthOtp.create({
    phone,
    otpHash: hashOtp(phone, otp),
    expiresAt,
  });

  if (process.env.NODE_ENV === "development") {
    console.log(`[DEV ONLY] AgriMama OTP: ${otp}`);
  }

  return { otp, expiresAt };
}

export async function verifyOtp(phone, submittedOtp) {
  validateOtpSecret();

  if (
    typeof phone !== "string" ||
    typeof submittedOtp !== "string" ||
    !/^\d{6}$/.test(submittedOtp)
  ) {
    return false;
  }

  const now = new Date();

  const record = await AuthOtp.findOne({
    where: {
      phone,
      consumedAt: null,
      expiresAt: { [Op.gt]: now },
      attempts: { [Op.lt]: MAX_ATTEMPTS },
    },
    order: [["createdAt", "DESC"]],
  });

  if (!record) {
    return false;
  }

  const submittedHash = hashOtp(phone, submittedOtp);

  const expected = Buffer.from(record.otpHash, "hex");
  const actual = Buffer.from(submittedHash, "hex");

  const matches =
    expected.length === actual.length &&
    crypto.timingSafeEqual(expected, actual);

  if (!matches) {
    // Increment attempts atomically, only if the OTP is still valid.
    await AuthOtp.increment("attempts", {
      by: 1,
      where: {
        id: record.id,
        consumedAt: null,
        expiresAt: { [Op.gt]: now },
        attempts: { [Op.lt]: MAX_ATTEMPTS },
      },
    });

    return false;
  }

  // Atomically consume the OTP.
  // Only one concurrent verification request can succeed.
  const [updatedCount] = await AuthOtp.update(
    { consumedAt: now },
    {
      where: {
        id: record.id,
        consumedAt: null,
        expiresAt: { [Op.gt]: now },
        attempts: { [Op.lt]: MAX_ATTEMPTS },
      },
    }
  );

  return updatedCount === 1;
}
