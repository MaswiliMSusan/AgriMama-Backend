
import FarmerObservation from "../models/farmerObservation.js";
import Conversation from "../models/conversation.js";
import Farmer from "../models/farmer.js";
import Farm from "../models/farm.js";
import CropCycle from "../models/cropCycle.js";
import Recommendation from "../models/recommendation.js";
import ConversationMessage from "../models/conversationMessage.js";

import { generateRecommendation } from "../services/decisionEngine.js";
import { interpretFarmerMessage } from "../services/ai/interpreter.js";
import { authenticate } from "../middleware/authenticate.js";

export default async function observationRoutes(fastify) {

  // Retrieve observations belonging to the authenticated farmer.
  fastify.get(
    "/observations/me",
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const user = request.authUser;
        if (user.role !== "farmer" || !user.farmerId) {
          return reply.code(403).send({
            success: false,
            error: "This endpoint is available to linked farmer accounts only.",
          });
        }

        const observations = await FarmerObservation.findAll({
          where: { farmerId: user.farmerId },
          include: [
            { model: Farm, as: "farm", attributes: ["id", "name"] },
            { model: CropCycle, as: "cropCycle", attributes: ["id", "crop", "variety", "currentStage"] },
            { model: Recommendation, as: "recommendations" },
          ],
          order: [["observedAt", "DESC"]],
        });

        return { success: true, count: observations.length, observations };
      } catch (error) {
        request.log.error(error);
        return reply.code(500).send({
          success: false,
          error: "Failed to retrieve your observations.",
        });
      }
    }
  );

  fastify.post(
    "/observations",
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const {
          farmerId: requestedFarmerId,
          farmId,
          cropCycleId,
          category,
          observation,
          message,
          language,
        } = request.body || {};

        const authenticatedUser = request.authUser;

        // Resolve farmer identity from the authenticated session.
        let farmerId;

        if (authenticatedUser.role === "farmer") {
          if (!authenticatedUser.farmerId) {
            return reply.code(403).send({
              success: false,
              error: "Your account is not linked to a farmer profile.",
            });
          }

          if (
            requestedFarmerId &&
            requestedFarmerId !== authenticatedUser.farmerId
          ) {
            return reply.code(403).send({
              success: false,
              error: "You cannot submit observations for another farmer.",
            });
          }

          farmerId = authenticatedUser.farmerId;

        } else if (["admin", "staff"].includes(authenticatedUser.role)) {
          farmerId = requestedFarmerId;

          if (!farmerId) {
            return reply.code(400).send({
              success: false,
              error: "A farmer ID is required.",
            });
          }

        } else {
          return reply.code(403).send({
            success: false,
            error: "You are not authorized to submit observations.",
          });
        }

        const farmerMessage =
          typeof message === "string" ? message.trim() : "";

        const manualObservation =
          typeof observation === "string" ? observation.trim() : "";

        // Validate required identifiers.
        if (!farmId || !cropCycleId) {
          return reply.code(400).send({
            success: false,
            error: "farmId and cropCycleId are required.",
          });
        }

        // Require either a natural-language message or structured details.
        if (!farmerMessage && (!category || !manualObservation)) {
          return reply.code(400).send({
            success: false,
            error:
              "Provide a message, or both category and observation.",
          });
        }

        // Load and validate the farmer, farm and crop cycle.
        const [farmer, farm, cropCycle] = await Promise.all([
          Farmer.findByPk(farmerId),
          Farm.findByPk(farmId),
          CropCycle.findByPk(cropCycleId),
        ]);

        if (!farmer || !farm || !cropCycle) {
          return reply.code(404).send({
            success: false,
            error: "Farmer, farm, or crop cycle was not found.",
          });
        }

        // Verify farmer, farm and crop-cycle relationships.
        if (
          farm.farmerId !== farmer.id ||
          cropCycle.farmId !== farm.id
        ) {
          return reply.code(400).send({
            success: false,
            error:
              "The farmer, farm, and crop cycle do not belong together.",
          });
        }

        const preferredLanguage =
          language || farmer.preferredLanguage || "dholuo";

        let finalCategory = category;
        let finalObservation = manualObservation;
        let interpretation = null;

        // Interpret natural-language messages using AI.
        if (farmerMessage) {
          interpretation = await interpretFarmerMessage(
            farmerMessage,
            {
              crop: cropCycle.crop,
              growthStage: cropCycle.currentStage,
              language: preferredLanguage,
            }
          );

          finalCategory = interpretation.category;
          finalObservation = farmerMessage;
        }

        if (!finalCategory || !finalObservation) {
          return reply.code(400).send({
            success: false,
            error:
              "A valid observation category and description are required.",
          });
        }

        // Save the farmer's observation.
        const farmerObservation = await FarmerObservation.create({
          farmerId: farmer.id,
          farmId: farm.id,
          cropCycleId: cropCycle.id,
          category: finalCategory,
          observation: finalObservation,
          observedAt: new Date(),
          source: farmerMessage ? "ai_interpreted" : "farmer",
          language: preferredLanguage,
        });

        // If AI needs clarification, ask a question before recommending.
        if (interpretation?.needsFollowUp) {
          const question = interpretation.followUpQuestions?.[0];

          if (!question) {
            throw new Error(
              "The interpreter requested follow-up but returned no question."
            );
          }

          const conversation = await Conversation.create({
            farmerId: farmer.id,
            farmId: farm.id,
            cropCycleId: cropCycle.id,
            observationId: farmerObservation.id,
            question,
            status: "awaiting_reply",
            askedAt: new Date(),
          });

          // Save the farmer's original observation.
await ConversationMessage.create({
  conversationId: conversation.id,
  sender: "farmer",
  message: farmerMessage,
  channel: "dashboard",
});

// Save the assistant's clarification question.
await ConversationMessage.create({
  conversationId: conversation.id,
  sender: "assistant",
  message: question,
  channel: "dashboard",
});

          return reply.code(201).send({
            success: true,
            status: "awaiting_clarification",
            observation: farmerObservation,
            interpretation,
            conversation,
            recommendation: null,
            followUpQuestions: interpretation.followUpQuestions,
          });
        }

        // Generate a recommendation only when clarification is not required.
        const recommendation = await generateRecommendation(
          cropCycle.id,
          farmerObservation.id
        );

        return reply.code(201).send({
          success: true,
          status: "processed",
          observation: farmerObservation,
          interpretation,
          conversation: null,
          recommendation,
          followUpQuestions: [],
        });

      } catch (error) {
        request.log.error(error);

        return reply.code(500).send({
          success: false,
          error: "Failed to process farmer observation.",
        });
      }
    }
  );
}
