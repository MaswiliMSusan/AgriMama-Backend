
import crypto from "node:crypto";
import formbody from "@fastify/formbody";

import Farmer from "../models/farmer.js";
import SmsInboundMessage from "../models/smsInboundMessage.js";
import { processFarmerMessage } from "../services/messages/processFarmerMessage.js";
import Conversation from "../models/conversation.js";
import { processAssistantMessage } from "../services/ai/assistantService.js";
import { sendFarmerSms } from "../services/sms/sendFarmerSms.js";


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

      // Call the shared processing service directly. The webhook has
      // already authenticated the provider using the shared webhook token.
      // Identify the registered farmer.
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

// Only respond to farmers who have opted in.
if (farmer.consentStatus !== true) {
  await inbound.update({
    status: "processed",
    processedAt: new Date(),
    errorMessage: null,
  });

  return reply.code(200).send({
    success: true,
    status: "sms_consent_required",
  });
}

// Do not generate responses if outbound SMS is disabled.
if (process.env.AT_SMS_ENABLED !== "true") {
  await inbound.update({
    status: "processed",
    processedAt: new Date(),
    errorMessage: null,
  });

  request.log.warn(
    { farmerId: farmer.id },
    "Inbound SMS received while outbound SMS is disabled."
  );

  return reply.code(200).send({
    success: true,
    status: "sms_disabled",
  });
}

// Check whether the farmer is answering an existing
// farming workflow question, such as crop selection
// or observation clarification.
const pendingConversation = await Conversation.findOne({
  where: {
    farmerId: farmer.id,
    status: "awaiting_reply",
  },
  order: [["askedAt", "DESC"]],
});

let farmerSms;
let processingType;

// Preserve the existing farming workflow when there
// is an outstanding question.
if (pendingConversation) {
  const result = await processFarmerMessage({
    fastify,
    phone: fromPhone,
    message: messageText,
    source: "sms_webhook",
    requestId: request.id,
  });

  if (result.statusCode < 200 || result.statusCode >= 300) {
    await inbound.update({
      status: "failed",
      errorMessage: `Message handler returned HTTP ${result.statusCode}`,
    });

    return reply.code(500).send({
      success: false,
      error: "AgriMama could not process the inbound SMS.",
    });
  }

  const responseBody = result.body || {};
  farmerSms = responseBody.farmerSms ?? responseBody.smsDelivery;
  processingType = "farming_workflow";
} else {
  // No outstanding farming workflow:
  // continue the farmer's AI Assistant conversation.
  const assistantConversation = await Conversation.findOne({
    where: {
      farmerId: farmer.id,
      purpose: "ai_assistant",
    },
    order: [["updatedAt", "DESC"]],
  });

  const assistantResult = await processAssistantMessage({
    fastify,
    authenticatedUser: {
      farmerId: farmer.id,
      role: "farmer",
    },
    message: messageText,
    conversationId: assistantConversation?.id || null,
    channel: "sms",
  });

  // Send the AI response through Africa's Talking.
  farmerSms = await sendFarmerSms({
    phone: fromPhone,
    message: assistantResult.message.assistant,
    requestId: request.id,
  });

  processingType = "ai_assistant";

  if (!farmerSms.success) {
    request.log.error(
      {
        farmerId: farmer.id,
        conversationId: assistantResult.conversationId,
        error: farmerSms.error,
        statusCode: farmerSms.statusCode,
      },
      "AI Assistant response generated but SMS delivery failed."
    );
  }
}

// Record the inbound message as processed.
// A failed outbound delivery is returned in the response;
// it should not cause the AI conversation to be generated
// again when Africa's Talking retries the inbound webhook.
await inbound.update({
  status: "processed",
  processedAt: new Date(),
  errorMessage: null,
});

return reply.code(200).send({
  success: true,
  status: "processed",
  processingType,
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
