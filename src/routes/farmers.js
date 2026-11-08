
import Farmer from "../models/farmer.js";

export default async function farmerRoutes(fastify) {
  // Register a farmer.
  fastify.post("/farmers", async (request, reply) => {
    try {
      const {
        name,
        phone,
        preferredLanguage = "dholuo",
        consentStatus = false,
      } = request.body || {};

      if (
        typeof name !== "string" ||
        !name.trim() ||
        typeof phone !== "string" ||
        !phone.trim()
      ) {
        return reply.code(400).send({
          error: "Farmer name and phone number are required.",
        });
      }

      if (typeof consentStatus !== "boolean") {
        return reply.code(400).send({
          error: "consentStatus must be true or false.",
        });
      }

      if (
        typeof preferredLanguage !== "string" ||
        !preferredLanguage.trim()
      ) {
        return reply.code(400).send({
          error: "A valid preferredLanguage is required.",
        });
      }

      const normalizedPhone = phone.trim().replace(/\s+/g, "");

      const existingFarmer = await Farmer.findOne({
        where: { phone: normalizedPhone },
      });

      if (existingFarmer) {
        return reply.code(409).send({
          error: "A farmer with this phone number already exists.",
        });
      }

      const farmer = await Farmer.create({
        name: name.trim(),
        phone: normalizedPhone,
        preferredLanguage: preferredLanguage.trim().toLowerCase(),
        consentStatus,
        consentAt: consentStatus ? new Date() : null,
      });

      return reply.code(201).send({
        success: true,
        farmer,
      });
    } catch (error) {
      request.log.error(error);

      if (error.name === "SequelizeUniqueConstraintError") {
        return reply.code(409).send({
          error: "A farmer with this phone number already exists.",
        });
      }

      return reply.code(500).send({
        error: "Failed to register farmer.",
      });
    }
  });

  // Retrieve one farmer's profile.
  fastify.get("/farmers/:id", async (request, reply) => {
    try {
      const farmer = await Farmer.findByPk(request.params.id, {
        attributes: {
          exclude: ["createdAt", "updatedAt"],
        },
      });

      if (!farmer) {
        return reply.code(404).send({
          error: "Farmer not found.",
        });
      }

      return {
        success: true,
        farmer,
      };
    } catch (error) {
      request.log.error(error);

      return reply.code(500).send({
        error: "Failed to retrieve farmer.",
      });
    }
  });

  // Update farmer profile and consent.
  fastify.patch("/farmers/:id", async (request, reply) => {
    try {
      const farmer = await Farmer.findByPk(request.params.id);

      if (!farmer) {
        return reply.code(404).send({
          error: "Farmer not found.",
        });
      }

      const {
        name,
        phone,
        preferredLanguage,
        consentStatus,
      } = request.body || {};

      if (name !== undefined) {
        if (typeof name !== "string" || !name.trim()) {
          return reply.code(400).send({
            error: "Name must be a non-empty string.",
          });
        }
        farmer.name = name.trim();
      }

      if (phone !== undefined) {
        if (typeof phone !== "string" || !phone.trim()) {
          return reply.code(400).send({
            error: "Phone must be a non-empty string.",
          });
        }

        const normalizedPhone = phone.trim().replace(/\s+/g, "");

        const existingFarmer = await Farmer.findOne({
          where: { phone: normalizedPhone },
        });

        if (existingFarmer && existingFarmer.id !== farmer.id) {
          return reply.code(409).send({
            error: "This phone number is already registered.",
          });
        }

        farmer.phone = normalizedPhone;
      }

      if (preferredLanguage !== undefined) {
        if (
          typeof preferredLanguage !== "string" ||
          !preferredLanguage.trim()
        ) {
          return reply.code(400).send({
            error: "preferredLanguage must be a non-empty string.",
          });
        }

        farmer.preferredLanguage =
          preferredLanguage.trim().toLowerCase();
      }

      if (consentStatus !== undefined) {
        if (typeof consentStatus !== "boolean") {
          return reply.code(400).send({
            error: "consentStatus must be true or false.",
          });
        }

        farmer.consentStatus = consentStatus;
        farmer.consentAt = consentStatus ? new Date() : null;
      }

      await farmer.save();

      return {
        success: true,
        farmer,
      };
    } catch (error) {
      request.log.error(error);

      if (error.name === "SequelizeUniqueConstraintError") {
        return reply.code(409).send({
          error: "This phone number is already registered.",
        });
      }

      return reply.code(500).send({
        error: "Failed to update farmer.",
      });
    }
  });
}
