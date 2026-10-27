import { generateRecommendation } from "../services/decisionEngine.js";

export default async function decisionRoutes(fastify) {
  fastify.post("/decisions", async (request, reply) => {
    try {
      const { cropCycleId } = request.body || {};

      if (!cropCycleId) {
        return reply.code(400).send({
          error: "cropCycleId is required.",
        });
      }

      const recommendation = await generateRecommendation(cropCycleId);

      return reply.code(201).send({
        success: true,
        recommendation,
      });
    } catch (error) {
      request.log.error(error);

      return reply.code(500).send({
        error: "Failed to generate recommendation.",
        message: error.message,
      });
    }
  });
}