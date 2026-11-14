
import { processFarmerMessage } from "../services/messages/processFarmerMessage.js";
import { authenticate } from "../middleware/authenticate.js";

export default async function messageRoutes(fastify) {
  fastify.post("/messages", { preHandler: authenticate }, async (request, reply) => {
    const {
      message,
      language,
      targetFarmerId,
      conversationId,
    } = request.body || {};

    const result = await processFarmerMessage({
      fastify,
      message,
      language,
      targetFarmerId,
      conversationId,
      authenticatedUser: request.authUser,
      source: "dashboard",
      requestId: request.id,
    });

    return reply.code(result.statusCode).send(result.body);
  });
}
