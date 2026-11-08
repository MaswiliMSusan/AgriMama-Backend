
import crypto from "node:crypto";
import formbody from "@fastify/formbody";

import Farmer from "../models/farmer.js";
import SmsInboundMessage from "../models/smsInboundMessage.js";

export default async function inboundSmsRoutes(fastify) {
  await fastify.register(formbody);

  fastify.post("/sms/inbound", async (request, reply) => {
    const expectedToken = process.env.AT_INBOUND_WEBHOOK_TOKEN;
    const suppliedToken =
      request.query?.token ||
      request.headers["x-agrimama-webhook-token"];

    if (!expectedToken) {
      request.log.error(
        "AT_INBOUND_WEBHOOK_TOKEN is not configured."
      );

      return reply.code(500).send({
        success: false,
        error: "Webhook is not configured.",
      });
    }

    const expected = Buffer.from(expectedToken);
    const supplied = Buffer.from(
      typeof suppliedToken === "string" ? suppliedToken : ""
    );

    if (
      expected.length !== supplied.length ||
      !crypto.timingSafeEqual(expected, supplied)
    ) {
      return reply.code(401).send({
        success: false,
        error: "Unauthorized.",
      });
    }

    const body = request.body || {};

    const providerMessageId = String(body.id || "").trim();
    const fromPhone = String(body.from || "").trim();
    const messageText = String(body.text || "").trim();

    if (!providerMessageId || !fromPhone || !messageText) {
      return reply.code(400).send({
        success: false,
        error: "Missing inbound SMS id, from, or text.",
      });
    }

    if (
      providerMessageId.length > 150 ||
      fromPhone.length > 30 ||
      messageText.length > 5000
    ) {
      return reply.code(400).send({
        success: false,
        error: "Inbound SMS payload exceeds allowed limits.",
      });
    }

    let inbound;

    try {
      inbound = await SmsInboundMessage.create({
        providerMessageId,
        fromPhone,
        messageText,
        status: "received",
      });
    } catch (error) {
      if (error.name === "SequelizeUniqueConstraintError") {
        return reply.code(200).send({
          success: true,
          status: "duplicate",
        });
      }

      request.log.error(error);

      return reply.code(500).send({
        success: false,
        error: "Could not record inbound SMS.",
      });
    }

    try {
      // Handle SMS consent commands before normal processing.
      const consentCommand = messageText.trim().toUpperCase();

      if (consentCommand === "STOP" || consentCommand === "START") {
        const farmer = await Farmer.findOne({
          where: { phone: fromPhone },
        });

        if (!farmer) {
          await inbound.update({
            status: "processed",
            processedAt: new Date(),
            errorMessage: null,
          });

          return reply.code(200).send({
            success: true,
            status: "farmer_not_registered",
          });
        }

        if (consentCommand === "STOP") {
          await farmer.update({
            consentStatus: false,
          });

          await inbound.update({
            status: "processed",
            processedAt: new Date(),
            errorMessage: null,
          });

          request.log.info(
            { farmerId: farmer.id },
            "Farmer opted out of SMS messages."
          );

          return reply.code(200).send({
            success: true,
            status: "sms_opted_out",
          });
        }

        await farmer.update({
          consentStatus: true,
          consentAt: new Date(),
        });

        await inbound.update({
          status: "processed",
          processedAt: new Date(),
          errorMessage: null,
        });

        request.log.info(
          { farmerId: farmer.id },
          "Farmer opted back in to SMS messages."
        );

        return reply.code(200).send({
          success: true,
          status: "sms_opted_in",
        });
      }

      // Reuse the existing AgriMama message workflow.
      const result = await fastify.inject({
        method: "POST",
        url: "/api/messages",
        payload: {
          phone: fromPhone,
          message: messageText,
          channel: "sms",
        },
      });

      const responseBody = result.json();

      if (result.statusCode < 200 || result.statusCode >= 300) {
        await inbound.update({
          status: "failed",
          errorMessage: `Message handler returned HTTP ${result.statusCode}`,
        });

        request.log.warn(
          {
            providerMessageId,
            statusCode: result.statusCode,
            result: responseBody,
          },
          "Inbound SMS could not be processed."
        );

        return reply.code(500).send({
          success: false,
          error: "AgriMama could not process the inbound SMS.",
        });
      }

      await inbound.update({
        status: "processed",
        processedAt: new Date(),
        errorMessage: null,
      });

      const farmerSms = responseBody.farmerSms;

return reply.code(200).send({
  success: true,
  status: "processed",
  providerMessageId,

  farmerSms: farmerSms
    ? {
        status: farmerSms.status ?? "unknown",
        success:
          typeof farmerSms.success === "boolean"
            ? farmerSms.success
            : null,
        actionCode: farmerSms.actionCode ?? null,
        messageId: farmerSms.messageId ?? null,
        statusCode: farmerSms.statusCode ?? null,
        requestId: farmerSms.requestId ?? null,
      }
    : null,
});


    } catch (error) {
      request.log.error(
        { err: error, providerMessageId },
        "Inbound SMS processing failed."
      );

      await inbound.update({
        status: "failed",
        errorMessage: error.message,
      });

      return reply.code(500).send({
        success: false,
        error: "Inbound SMS processing failed.",
      });
    }
  });
}
