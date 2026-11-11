
import { Op } from "sequelize";

import {
  Farmer,
  User,
  AuthOtp,
} from "../../models/index.js";

import {
  generateOtp,
  verifyOtp,
} from "../../services/auth/otpService.js";

import {
  createSession,
} from "../../services/auth/sessionService.js";

import {
  sendFarmerSms,
} from "../../services/sms/sendFarmerSms.js";

function normalizePhone(phone) {
  return String(phone || "").replace(/\s+/g, "").trim();
}

export default async function farmerAuthRoutes(fastify) {

  // -----------------------------------------
  // Request OTP
  // POST /api/auth/farmer/request-otp
  // -----------------------------------------

  fastify.post("/request-otp", 
    {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: "1 hour",
      },
    },
  },
    async (request, reply) => {
    const phone = normalizePhone(request.body?.phone);

    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      return reply.code(400).send({
        success: false,
        message: "Enter a valid phone number with country code.",
      });
    }

    if (process.env.AT_SMS_ENABLED !== "true") {
      return reply.code(503).send({
        success: false,
        message: "SMS service is currently disabled.",
      });
    }

    // Only registered farmers can request farmer OTP login.
    const farmer = await Farmer.findOne({
      where: { phone },
    });

    if (!farmer) {
      return reply.code(404).send({
        success: false,
        message: "No farmer account found for this phone number.",
      });
    }

    // Limit requests to five per phone number per hour.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const requestCount = await AuthOtp.count({
      where: {
        phone,
        createdAt: {
          [Op.gte]: oneHourAgo,
        },
      },
    });

    if (requestCount >= 5) {
      return reply.code(429).send({
        success: false,
        message: "Too many OTP requests. Please try again later.",
      });
    }

    // Enforce a 60-second resend interval.
    const recentRequest = await AuthOtp.findOne({
      where: {
        phone,
        createdAt: {
          [Op.gte]: new Date(Date.now() - 60 * 1000),
        },
      },
    });

    if (recentRequest) {
      return reply.code(429).send({
        success: false,
        message: "Please wait before requesting another OTP.",
      });
    }

    const { otp } = await generateOtp(phone);

    // In Sandbox, send to the configured test recipient.
    const environment = process.env.AT_ENVIRONMENT || "sandbox";

    const recipient =
      environment === "sandbox"
        ? normalizePhone(process.env.AT_TEST_PHONE)
        : phone;

    if (!recipient) {
      return reply.code(500).send({
        success: false,
        message: "Sandbox test phone is not configured.",
      });
    }

    const smsResult = await sendFarmerSms({
      phone: recipient,
      message: `Your AgriMama verification code is ${otp}. It expires in 5 minutes. Do not share this code.`,
      requestId: `otp-${Date.now()}`,
    });

    if (!smsResult.success) {
      // Prevent verification of an OTP that was not successfully submitted.
      await AuthOtp.update(
        { consumedAt: new Date() },
        {
          where: {
            phone,
            consumedAt: null,
          },
        }
      );

      request.log.error(
        { requestId: smsResult.requestId },
        "OTP SMS submission failed"
      );

      return reply.code(502).send({
        success: false,
        message: "Unable to send verification code. Please try again.",
      });
    }

    return reply.send({
      success: true,
      message: "Verification code submitted successfully.",
      expiresIn: 300,
      delivery: "submitted",
      providerMessageId: smsResult.messageId,
    });
  });

  // -----------------------------------------
  // Verify OTP
  // POST /api/auth/farmer/verify-otp
  // -----------------------------------------

  fastify.post("/verify-otp", 
    {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "15 minutes",
      },
    },
  },
    async (request, reply) => {
    const phone = normalizePhone(request.body?.phone);
    const otp = String(request.body?.otp || "").trim();

    if (!/^\+[1-9]\d{7,14}$/.test(phone) || !/^\d{6}$/.test(otp)) {
      return reply.code(400).send({
        success: false,
        message: "A valid phone number and six-digit OTP are required.",
      });
    }

    const valid = await verifyOtp(phone, otp);

    if (!valid) {
      return reply.code(401).send({
        success: false,
        message: "Invalid or expired OTP.",
      });
    }

    const farmer = await Farmer.findOne({
      where: { phone },
    });

    if (!farmer) {
      return reply.code(404).send({
        success: false,
        message: "Farmer profile not found.",
      });
    }

    // Find an existing login account for this farmer.
    let user = await User.findOne({
      where: {
        farmerId: farmer.id,
      },
    });

    if (!user) {
      // Do not attach a farmer to an existing unrelated account.
      const phoneConflict = await User.findOne({
        where: { phone },
      });

      if (phoneConflict) {
        return reply.code(409).send({
          success: false,
          message: "This phone number is already linked to another login account.",
        });
      }

      // Provision the farmer's login account after phone verification.
      user = await User.create({
        farmerId: farmer.id,
        name: farmer.name,
        phone: farmer.phone,
        role: "farmer",
        isActive: true,
      });
    }

    if (user.role !== "farmer" || !user.isActive) {
      return reply.code(403).send({
        success: false,
        message: "This account cannot access farmer login.",
      });
    }

    const { token, expiresAt } = await createSession(user.id);

    await user.update({
      lastLoginAt: new Date(),
    });

    reply.setCookie("agrimama_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    return reply.send({
      success: true,
      message: "Login successful.",
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        farmerId: user.farmerId,
      },
    });
  });
}
