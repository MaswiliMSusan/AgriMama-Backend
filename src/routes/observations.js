
import FarmerObservation from "../models/farmerObservation.js";
import Conversation from "../models/conversation.js";
import Farmer from "../models/farmer.js";
import Farm from "../models/farm.js";
import CropCycle from "../models/cropCycle.js";

import { generateRecommendation } from "../services/decisionEngine.js";
import { interpretFarmerMessage } from "../services/ai/interpreter.js";

export default async function observationRoutes(fastify) {
  fastify.post("/observations", async (request, reply) => {
    try {
      const {
        farmerId,
        farmId,
        cropCycleId,
        category,
        observation,
        message,
        language,
      } = request.body || {};

      const farmerMessage =
        typeof message === "string" ? message.trim() : "";

      const manualObservation =
        typeof observation === "string" ? observation.trim() : "";

      // Validate required identifiers.
      if (!farmerId || !farmId || !cropCycleId) {
        return reply.code(400).send({
          error: "farmerId, farmId, and cropCycleId are required.",
        });
      }

      // Require either a natural-language message or structured details.
      if (!farmerMessage && (!category || !manualObservation)) {
        return reply.code(400).send({
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
          error: "Farmer, farm, or crop cycle was not found.",
        });
      }

      if (
        farm.farmerId !== farmer.id ||
        cropCycle.farmId !== farm.id
      ) {
        return reply.code(400).send({
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
          error: "A valid observation category and description are required.",
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

      // If AI needs clarification, ask a question before recommending action.
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
        error: "Failed to process farmer observation.",
      });
    }
  });
}
