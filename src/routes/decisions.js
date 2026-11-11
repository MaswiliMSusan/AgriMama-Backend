
import { generateRecommendation } from "../services/decisionEngine.js";
import { authenticate } from "../middleware/authenticate.js";

import CropCycle from "../models/cropCycle.js";
import Farm from "../models/farm.js";

export default async function decisionRoutes(fastify) {
  fastify.post(
    "/decisions",
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { cropCycleId } = request.body || {};
        const authenticatedUser = request.authUser;

        if (!cropCycleId) {
          return reply.code(400).send({
            success: false,
            error: "cropCycleId is required.",
          });
        }

        // Only farmers, staff and admins can generate recommendations.
        if (
          !["farmer", "staff", "admin"].includes(authenticatedUser.role)
        ) {
          return reply.code(403).send({
            success: false,
            error: "You are not authorized to generate recommendations.",
          });
        }

        // Find the requested crop cycle.
        const cropCycle = await CropCycle.findByPk(cropCycleId);

        if (!cropCycle) {
          return reply.code(404).send({
            success: false,
            error: "Crop cycle not found.",
          });
        }

        // Find the farm associated with this crop cycle.
        const farm = await Farm.findByPk(cropCycle.farmId);

        if (!farm) {
          return reply.code(404).send({
            success: false,
            error: "Farm associated with this crop cycle was not found.",
          });
        }

        // Enforce farmer ownership.
        if (authenticatedUser.role === "farmer") {
          if (!authenticatedUser.farmerId) {
            return reply.code(403).send({
              success: false,
              error: "Your account is not linked to a farmer profile.",
            });
          }

          if (farm.farmerId !== authenticatedUser.farmerId) {
            return reply.code(403).send({
              success: false,
              error: "You cannot generate recommendations for another farmer's crop cycle.",
            });
          }
        }

        // Generate recommendation using the validated crop cycle.
        const recommendation = await generateRecommendation(
          cropCycle.id
        );

        return reply.code(201).send({
          success: true,
          recommendation,
        });

      } catch (error) {
        request.log.error(error);

        return reply.code(500).send({
          success: false,
          error: "Failed to generate recommendation.",
        });
      }
    }
  );
}
