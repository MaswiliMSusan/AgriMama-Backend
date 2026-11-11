import Farmer from "../models/farmer.js";
import { authenticate } from "../middleware/authenticate.js";

const STAFF_ROLES = ["admin", "staff"];

export default async function farmerRoutes(fastify) {
  // Register a farmer. SMS consent must be obtained separately.
  fastify.post("/farmers", async (request, reply) => {
    try {
      const {
        name,
        phone,
        preferredLanguage = "dholuo",
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
        consentStatus: false,
        consentAt: null,
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

  // Retrieve a farmer's profile.
  fastify.get(
    "/farmers/:id",
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const isStaff = STAFF_ROLES.includes(request.authUser.role);

        const where = { id: request.params.id };

        if (!isStaff) {
          if (
            request.authUser.role !== "farmer" ||
            !request.authUser.farmerId
          ) {
            return reply.code(403).send({
              error: "You do not have permission to access this resource.",
            });
          }

          where.id = request.authUser.farmerId;
        }

        const farmer = await Farmer.findOne({
          where,
          attributes: { exclude: ["createdAt", "updatedAt"] },
        });

        if (!farmer) {
          return reply.code(404).send({
            error: "Farmer not found.",
          });
        }

        return { success: true, farmer };
      } catch (error) {
        request.log.error(error);

        return reply.code(500).send({
          error: "Failed to retrieve farmer.",
        });
      }
    }
  );

  // Update a farmer's profile.
  fastify.patch(
    "/farmers/:id",
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const isStaff = STAFF_ROLES.includes(request.authUser.role);

        if (
          !isStaff &&
          (
            request.authUser.role !== "farmer" ||
            request.authUser.farmerId !== request.params.id
          )
        ) {
          return reply.code(403).send({
            error: "You do not have permission to update this profile.",
          });
        }

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

        // Consent is controlled through the explicit SMS consent workflow.
        if (consentStatus !== undefined) {
          return reply.code(400).send({
            error: "SMS consent must be updated through the consent workflow.",
          });
        }

        if (name !== undefined) {
          if (typeof name !== "string" || !name.trim()) {
            return reply.code(400).send({
              error: "Name must be a non-empty string.",
            });
          }

          farmer.name = name.trim();
        }

        if (phone !== undefined) {
          // Farmers cannot change their login phone without a separate
          // phone-verification workflow.
          if (!isStaff) {
            return reply.code(403).send({
              error: "Contact support to change your registered phone number.",
            });
          }

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

        await farmer.save();

        return { success: true, farmer };
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
    }
  );
}