
import { processAssistantMessage } from "../services/ai/assistantService.js";
import { authenticate } from "../middleware/authenticate.js";

export default async function assistantRoutes(fastify) {
  fastify.post(
    "/assistant/chat",
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const {
          message,
          conversationId = null,
          channel = "dashboard",
        } = request.body || {};

        if (typeof message !== "string" || !message.trim()) {
          return reply.code(400).send({
            success: false,
            error: "Please enter a message.",
          });
        }

        if (
          conversationId !== null &&
          typeof conversationId !== "string"
        ) {
          return reply.code(400).send({
            success: false,
            error: "Invalid conversation ID.",
          });
        }

        const result = await processAssistantMessage({
          fastify,
          authenticatedUser: request.authUser,
          message,
          conversationId,
          channel,
        });

        return reply.code(200).send(result);
      } catch (error) {
        request.log.error(
          { err: error },
          "AgriMama assistant request failed"
        );

        const clientErrors = [
          "A registered farmer account is required.",
          "Please enter a message.",
          "Assistant conversation not found.",
          "Unsupported conversation channel.",
          "Farmer profile not found.",
        ];

        if (clientErrors.includes(error.message)) {
          return reply.code(400).send({
            success: false,
            error: error.message,
          });
        }

        return reply.code(500).send({
          success: false,
          error: "AgriMama could not process your message. Please try again.",
        });
      }
    }
  );
}
