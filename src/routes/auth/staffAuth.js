
import { User } from "../../models/index.js";

import { verifyPassword } from "../../services/auth/passwordService.js";
import { createSession } from "../../services/auth/sessionService.js";

export default async function staffAuthRoutes(fastify) {
  fastify.post("/login", 
    
    {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: "15 minutes",
      },
    },
  },
    async (request, reply) => {
    try {
      const email = String(request.body?.email || "")
        .trim()
        .toLowerCase();

      const password = request.body?.password;

      if (
        !email ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof password !== "string" ||
        !password
      ) {
        return reply.code(400).send({
          success: false,
          message: "A valid email address and password are required.",
        });
      }

      const user = await User.findOne({
        where: { email },
      });

      if (
        !user ||
        !user.isActive ||
        !["admin", "staff"].includes(user.role)
      ) {
        return reply.code(401).send({
          success: false,
          message: "Invalid email or password.",
        });
      }

      const passwordValid = await verifyPassword(
        password,
        user.passwordHash
      );

      if (!passwordValid) {
        return reply.code(401).send({
          success: false,
          message: "Invalid email or password.",
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

      request.log.info(
        {
          userId: user.id,
          role: user.role,
        },
        "Staff login successful"
      );

      return reply.code(200).send({
        success: true,
        message: "Login successful.",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      request.log.error(
        { err: error },
        "Staff authentication error"
      );

      return reply.code(500).send({
        success: false,
        message: "An error occurred during login.",
      });
    }
  });
}
