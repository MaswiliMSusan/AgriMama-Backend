
import { revokeSession } from "../../services/auth/sessionService.js";
import { authenticate } from "../../middleware/authenticate.js";

export default async function sessionRoutes(fastify) {
  // Get the currently authenticated user
  fastify.get(
    "/me",
    { preHandler: authenticate },
    async (request) => {
      const user = request.authUser;

      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          farmerId: user.farmerId,
        },
      };
    }
  );

  // Logout and revoke the current session
  fastify.post("/logout", async (request, reply) => {
    const token = request.cookies?.agrimama_session;

    if (typeof token === "string" && token.length > 0) {
      await revokeSession(token);
    }

    reply.clearCookie("agrimama_session", {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    return reply.code(200).send({
      success: true,
      message: "You have been logged out.",
    });
  });
}
