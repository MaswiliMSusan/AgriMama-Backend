
import { findSession } from "../services/auth/sessionService.js";

export async function authenticate(request, reply) {
  const token = request.cookies?.agrimama_session;

  if (!token) {
    return reply.code(401).send({
      success: false,
      message: "Authentication required.",
    });
  }

  const session = await findSession(token);

  if (!session || !session.user || !session.user.isActive) {
    return reply.code(401).send({
      success: false,
      message: "Your session is invalid or has expired. Please log in again.",
    });
  }

  request.authUser = session.user;
  request.authSession = session;
}
