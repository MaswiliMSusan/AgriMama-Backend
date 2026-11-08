
import Farm from "../models/farm.js";
import Farmer from "../models/farmer.js";

export default async function farmRoutes(fastify) {
  // Register a farm under an existing farmer.
  fastify.post("/farms", async (request, reply) => {
    try {
      const {
        farmerId,
        name,
        sizeAcres,
        latitude,
        longitude,
        locationAccuracyMeters,
      } = request.body || {};

      if (!farmerId) {
        return reply.code(400).send({
          error: "farmerId is required.",
        });
      }

      const farmer = await Farmer.findByPk(farmerId);

      if (!farmer) {
        return reply.code(404).send({
          error: "Farmer not found.",
        });
      }

      if (
        name !== undefined &&
        (typeof name !== "string" || !name.trim())
      ) {
        return reply.code(400).send({
          error: "Farm name must be a non-empty string.",
        });
      }

      if (
        sizeAcres !== undefined &&
        (!Number.isFinite(Number(sizeAcres)) ||
          Number(sizeAcres) <= 0)
      ) {
        return reply.code(400).send({
          error: "sizeAcres must be a positive number.",
        });
      }

      if (
        latitude !== undefined &&
        (!Number.isFinite(Number(latitude)) ||
          Number(latitude) < -90 ||
          Number(latitude) > 90)
      ) {
        return reply.code(400).send({
          error: "latitude must be between -90 and 90.",
        });
      }

      if (
        longitude !== undefined &&
        (!Number.isFinite(Number(longitude)) ||
          Number(longitude) < -180 ||
          Number(longitude) > 180)
      ) {
        return reply.code(400).send({
          error: "longitude must be between -180 and 180.",
        });
      }

      if (
        locationAccuracyMeters !== undefined &&
        (!Number.isFinite(Number(locationAccuracyMeters)) ||
          Number(locationAccuracyMeters) < 0)
      ) {
        return reply.code(400).send({
          error: "locationAccuracyMeters must be zero or greater.",
        });
      }

      const farm = await Farm.create({
        farmerId: farmer.id,
        name: name?.trim() || null,
        sizeAcres: sizeAcres ?? null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        locationAccuracyMeters: locationAccuracyMeters ?? null,
      });

      return reply.code(201).send({
        success: true,
        message: "Farm registered successfully.",
        farm,
      });
    } catch (error) {
      request.log.error(error);

      return reply.code(500).send({
        error: "Failed to register farm.",
      });
    }
  });

  // Retrieve a single farm.
  fastify.get("/farms/:id", async (request, reply) => {
    try {
      const farm = await Farm.findByPk(request.params.id);

      if (!farm) {
        return reply.code(404).send({
          error: "Farm not found.",
        });
      }

      return {
        success: true,
        farm,
      };
    } catch (error) {
      request.log.error(error);

      return reply.code(500).send({
        error: "Failed to retrieve farm.",
      });
    }
  });

  // Retrieve all farms belonging to a farmer.
  fastify.get(
    "/farmers/:farmerId/farms",
    async (request, reply) => {
      try {
        const { farmerId } = request.params;

        const farmer = await Farmer.findByPk(farmerId);

        if (!farmer) {
          return reply.code(404).send({
            error: "Farmer not found.",
          });
        }

        const farms = await Farm.findAll({
          where: { farmerId },
          order: [["createdAt", "DESC"]],
        });

        return {
          success: true,
          count: farms.length,
          farms,
        };
      } catch (error) {
        request.log.error(error);

        return reply.code(500).send({
          error: "Failed to retrieve farmer farms.",
        });
      }
    }
  );
}
