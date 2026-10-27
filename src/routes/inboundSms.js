
import crypto from "node:crypto";
import formbody from "@fastify/formbody";
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
      if (error.name !== "SequelizeUniqueConstraintError") {
        request.log.error(error);

        return reply.code(500).send({
          success: false,
          error: "Could not record inbound SMS.",
        });
      }

      inbound = await SmsInboundMessage.findOne({
        where: { providerMessageId },
      });

      if (!inbound) {
        return reply.code(500).send({
          success: false,
          error: "Could not retrieve existing inbound SMS.",
        });
      }

      // Never process a reused ID with different content.
      if (
        inbound.fromPhone !== fromPhone ||
        inbound.messageText !== messageText
      ) {
        return reply.code(409).send({
          success: false,
          error: "Message ID was reused with different content.",
        });
      }

      if (inbound.status === "processed") {
        return reply.code(200).send({
          success: true,
          status: "duplicate",
        });
      }

      if (inbound.status === "processing") {
        return reply.code(409).send({
          success: false,
          status: "processing",
          error: "This SMS is already being processed.",
        });
      }

      // Retry records that were received but not completed,
      // or previously failed.
      const [updatedCount] = await SmsInboundMessage.update(
        {
          status: "processing",
          errorMessage: null,
        },
        {
          where: {
            id: inbound.id,
            status: inbound.status,
          },
        }
      );

      if (updatedCount === 0) {
        return reply.code(409).send({
          success: false,
          status: "processing",
          error: "Another request may be processing this SMS.",
        });
      }

      inbound = await SmsInboundMessage.findByPk(inbound.id);
    }

    try {
      // Mark newly created records as processing.
      if (inbound.status === "received") {
        await inbound.update({ status: "processing" });
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
          errorMessage:
            `Message handler returned HTTP ${result.statusCode}`,
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

      return reply.code(200).send({
        success: true,
        status: "processed",
        providerMessageId,
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
