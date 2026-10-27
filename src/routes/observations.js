import FarmerObservation from "../models/farmerObservation.js";
import { generateRecommendation } from "../services/decisionEngine.js";
import { interpretFarmerMessage } from "../services/ai/interpreter.js";
import Farmer from "../models/farmer.js";
import Farm from "../models/farm.js";
import CropCycle from "../models/cropCycle.js";

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

      if (!farmerId || !farmId || !cropCycleId) {
        return reply.code(400).send({
          error: "farmerId, farmId, and cropCycleId are required.",
        });
      }

      /*
       * AI path:
       * If the farmer sends a natural-language message,
       * let the AI interpreter determine the observation category.
       */
      let finalCategory = category;
      let finalObservation = observation;
      let interpretation = null;

      if (message) {
        const farmer = await Farmer.findByPk(farmerId);
        const farm = await Farm.findByPk(farmId);
        const cropCycle = await CropCycle.findByPk(cropCycleId);

        if (!farmer || !farm || !cropCycle) {
          return reply.code(404).send({
            error: "Farmer, farm, or crop cycle was not found.",
          });
        }

        interpretation = await interpretFarmerMessage(message, {
          crop: cropCycle.crop,
          growthStage: cropCycle.currentStage,
          language:
            language ||
            farmer.preferredLanguage ||
            "en",
        });

        finalCategory = interpretation.category;
        finalObservation = message;
      }

      /*
       * Backward-compatible path:
       * Existing clients can still send category + observation.
       */
      if (!finalCategory || !finalObservation) {
        return reply.code(400).send({
          error:
            "Either message or both category and observation are required.",
        });
      }

      const farmerObservation = await FarmerObservation.create({
        farmerId,
        farmId,
        cropCycleId,
        category: finalCategory,
        observation: finalObservation,
        observedAt: new Date(),
        source: message ? "ai_interpreted" : "farmer",
        language: language || null,
      });

      const recommendation = await generateRecommendation(cropCycleId);

      return reply.code(201).send({
        success: true,
        observation: farmerObservation,
        interpretation,
        recommendation,
      });
    } catch (error) {
      request.log.error(error);

      return reply.code(500).send({
        error: "Failed to process farmer observation.",
        message: error.message,
      });
    }
  });
}