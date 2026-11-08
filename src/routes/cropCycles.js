
import CropCycle from "../models/cropCycle.js";
import Farm from "../models/farm.js";

const ALLOWED_STATUSES = ["active", "completed"];

function isValidDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export default async function cropCycleRoutes(fastify) {
  // Register a crop cycle under a farm.
  fastify.post("/crop-cycles", async (request, reply) => {
    try {
      const {
        farmId,
        crop = "maize",
        variety,
        plantingDate,
        currentStage,
        status = "active",
      } = request.body || {};

      if (!farmId) {
        return reply.code(400).send({
          error: "farmId is required.",
        });
      }

      if (!plantingDate || !isValidDateOnly(plantingDate)) {
        return reply.code(400).send({
          error: "plantingDate is required and must use YYYY-MM-DD format.",
        });
      }

      if (typeof crop !== "string" || !crop.trim()) {
        return reply.code(400).send({
          error: "crop must be a non-empty string.",
        });
      }

      if (
        variety !== undefined &&
        variety !== null &&
        typeof variety !== "string"
      ) {
        return reply.code(400).send({
          error: "variety must be a string.",
        });
      }

      if (
        currentStage !== undefined &&
        currentStage !== null &&
        typeof currentStage !== "string"
      ) {
        return reply.code(400).send({
          error: "currentStage must be a string.",
        });
      }

      if (!ALLOWED_STATUSES.includes(status)) {
        return reply.code(400).send({
          error: `status must be one of: ${ALLOWED_STATUSES.join(", ")}.`,
        });
      }

      const farm = await Farm.findByPk(farmId);

      if (!farm) {
        return reply.code(404).send({
          error: "Farm not found.",
        });
      }

      const cropCycle = await CropCycle.create({
        farmId: farm.id,
        crop: crop.trim().toLowerCase(),
        variety: variety?.trim() || null,
        plantingDate,
        currentStage: currentStage?.trim() || null,
        status,
      });

      return reply.code(201).send({
        success: true,
        message: "Crop cycle registered successfully.",
        cropCycle,
      });
    } catch (error) {
      request.log.error(error);

      return reply.code(500).send({
        error: "Failed to register crop cycle.",
      });
    }
  });

  // Retrieve one crop cycle.
  fastify.get("/crop-cycles/:id", async (request, reply) => {
    try {
      const cropCycle = await CropCycle.findByPk(request.params.id);

      if (!cropCycle) {
        return reply.code(404).send({
          error: "Crop cycle not found.",
        });
      }

      return {
        success: true,
        cropCycle,
      };
    } catch (error) {
      request.log.error(error);

      return reply.code(500).send({
        error: "Failed to retrieve crop cycle.",
      });
    }
  });

  // List crop cycles belonging to a farm.
  fastify.get(
    "/farms/:farmId/crop-cycles",
    async (request, reply) => {
      try {
        const { farmId } = request.params;

        const farm = await Farm.findByPk(farmId);

        if (!farm) {
          return reply.code(404).send({
            error: "Farm not found.",
          });
        }

        const cropCycles = await CropCycle.findAll({
          where: { farmId },
          order: [["plantingDate", "DESC"]],
        });

        return {
          success: true,
          count: cropCycles.length,
          cropCycles,
        };
      } catch (error) {
        request.log.error(error);

        return reply.code(500).send({
          error: "Failed to retrieve crop cycles.",
        });
      }
    }
  );

  // Update a crop cycle.
  fastify.patch("/crop-cycles/:id", async (request, reply) => {
    try {
      const cropCycle = await CropCycle.findByPk(request.params.id);

      if (!cropCycle) {
        return reply.code(404).send({
          error: "Crop cycle not found.",
        });
      }

      const {
        crop,
        variety,
        plantingDate,
        currentStage,
        status,
      } = request.body || {};

      if (crop !== undefined) {
        if (typeof crop !== "string" || !crop.trim()) {
          return reply.code(400).send({
            error: "crop must be a non-empty string.",
          });
        }

        cropCycle.crop = crop.trim().toLowerCase();
      }

      if (variety !== undefined) {
        if (variety !== null && typeof variety !== "string") {
          return reply.code(400).send({
            error: "variety must be a string or null.",
          });
        }

        cropCycle.variety = variety?.trim() || null;
      }

      if (plantingDate !== undefined) {
        if (!isValidDateOnly(plantingDate)) {
          return reply.code(400).send({
            error: "plantingDate must use YYYY-MM-DD format.",
          });
        }

        cropCycle.plantingDate = plantingDate;
      }

      if (currentStage !== undefined) {
        if (
          currentStage !== null &&
          typeof currentStage !== "string"
        ) {
          return reply.code(400).send({
            error: "currentStage must be a string or null.",
          });
        }

        cropCycle.currentStage = currentStage?.trim() || null;
      }

      if (status !== undefined) {
        if (!ALLOWED_STATUSES.includes(status)) {
          return reply.code(400).send({
            error: `status must be one of: ${ALLOWED_STATUSES.join(", ")}.`,
          });
        }

        cropCycle.status = status;
      }

      await cropCycle.save();

      return {
        success: true,
        message: "Crop cycle updated successfully.",
        cropCycle,
      };
    } catch (error) {
      request.log.error(error);

      return reply.code(500).send({
        error: "Failed to update crop cycle.",
      });
    }
  });
}
