
import { resolveFarmerContext } from "../services/farmerContext.js";
import { interpretFarmerMessage } from "../services/ai/interpreter.js";
import { generateRecommendation } from "../services/decisionEngine.js";
import { sendFarmerSms } from "../services/sms/sendFarmerSms.js";
import { getFarmerResponse } from "../services/responses/farmerResponses.js";

import Farmer from "../models/farmer.js";
import Farm from "../models/farm.js";
import CropCycle from "../models/cropCycle.js";
import FarmerObservation from "../models/farmerObservation.js";
import Conversation from "../models/conversation.js";

export default async function messageRoutes(fastify) {
  /**
   * Send an approved recommendation response when permitted.
   * Recommendations requiring human review are never sent automatically.
   */
  async function sendRecommendationSms({
    phone,
    recommendation,
    language,
    channel,
    requestId,
  }) {
    if (
      channel !== "sms" ||
      process.env.AT_SMS_ENABLED !== "true"
    ) {
      return {
        status: "not_sent",
        reason: "sms_disabled_or_other_channel",
      };
    }

    if (!recommendation?.actionCode) {
      return {
        status: "not_sent",
        reason: "no_action_code",
      };
    }

    if (recommendation.requiresHumanReview) {
      return { status: "awaiting_human_review" };
    }

    let response;

    try {
      response = getFarmerResponse(
        recommendation.actionCode,
        language || "en"
      );
    } catch (error) {
      fastify.log.warn(
        {
          requestId,
          actionCode: recommendation.actionCode,
        },
        "No approved farmer response template is available."
      );

      return {
        status: "not_sent",
        reason: "template_unavailable",
      };
    }

    if (response.status !== "ready" || !response.message) {
      return {
        status: "not_sent",
        reason: "translation_unavailable",
        language: language || "en",
      };
    }

    const delivery = await sendFarmerSms({
      phone,
      message: response.message,
      requestId,
    });

    if (!delivery.success) {
      fastify.log.warn(
        {
          requestId,
          actionCode: recommendation.actionCode,
          error: delivery.error,
          statusCode: delivery.statusCode,
        },
        "AgriMama recommendation SMS submission failed."
      );

      return {
        status: "failed",
        ...delivery,
      };
    }

    return {
      status: "submitted",
      actionCode: recommendation.actionCode,
      language: language || "en",
      ...delivery,
    };
  }

  /**
   * Send a clarification question only when SMS is enabled
   * and the request channel is SMS.
   */
  async function sendClarificationSms({
    phone,
    question,
    channel,
    requestId,
  }) {
    if (
      process.env.AT_SMS_ENABLED !== "true" ||
      channel !== "sms"
    ) {
      return {
        enabled: false,
        success: false,
        status: "not_sent",
      };
    }

    const result = await sendFarmerSms({
      phone,
      message: question,
      requestId,
    });

    if (!result.success) {
      fastify.log.warn(
        {
          requestId,
          status: result.status,
          error: result.error,
        },
        "AgriMama clarification SMS submission failed."
      );
    }

    return {
      enabled: true,
      ...result,
    };
  }

  fastify.post("/messages", async (request, reply) => {
    try {
      const {
        phone,
        message,
        language,
        channel = "sms",
      } = request.body || {};

      // Validate the incoming message.
      if (
        typeof phone !== "string" ||
        !phone.trim() ||
        typeof message !== "string" ||
        !message.trim()
      ) {
        return reply.code(400).send({
          success: false,
          error: "phone and message are required.",
        });
      }

      const normalizedPhone = phone.trim();
      const normalizedMessage = message.trim();

      // 1. Check for a registered farmer and pending conversation.
      const registeredFarmer = await Farmer.findOne({
        where: { phone: normalizedPhone },
      });

      if (registeredFarmer) {
        const pendingConversation = await Conversation.findOne({
          where: {
            farmerId: registeredFarmer.id,
            status: "awaiting_reply",
          },
          include: [
            {
              model: FarmerObservation,
              as: "originalObservation",
              required: true,
            },
            {
              model: Farm,
              as: "farm",
              required: true,
            },
            {
              model: CropCycle,
              as: "cropCycle",
              required: true,
            },
          ],
          order: [["askedAt", "DESC"]],
        });

        if (pendingConversation) {
          const farm = pendingConversation.farm;
          const cropCycle = pendingConversation.cropCycle;
          const originalObservation =
            pendingConversation.originalObservation;

          const preferredLanguage =
            language ||
            registeredFarmer.preferredLanguage ||
            "en";

          // Keep the original report and any previous reply
          // available to the interpreter.
          const observationContext = [
            originalObservation.observation,
            pendingConversation.answer
              ? `Previous farmer reply: ${pendingConversation.answer}`
              : null,
          ]
            .filter(Boolean)
            .join("\n");

          const interpretation = await interpretFarmerMessage(
            normalizedMessage,
            {
              crop: cropCycle.crop,
              growthStage: cropCycle.currentStage,
              language: preferredLanguage,
              originalObservation: observationContext,
              followUpQuestion: pendingConversation.question,
            }
          );

          // Save the clarification reply as a separate observation.
          const answerObservation = await FarmerObservation.create({
            farmerId: registeredFarmer.id,
            farmId: farm.id,
            cropCycleId: cropCycle.id,
            category: interpretation.category,
            observation: normalizedMessage,
            observedAt: new Date(),
            source: "farmer_reply",
            language: preferredLanguage,
          });

          // 1A. The interpreter needs another clarification.
          if (interpretation.needsFollowUp) {
            const nextQuestion =
              interpretation.followUpQuestions?.[0];

            if (!nextQuestion) {
              throw new Error(
                "The interpreter requested follow-up but returned no question."
              );
            }

            await pendingConversation.update({
              answer: normalizedMessage,
              answerObservationId: answerObservation.id,
              question: nextQuestion,
              askedAt: new Date(),
              status: "awaiting_reply",
              completedAt: null,
            });

            const smsDelivery = await sendClarificationSms({
              phone: normalizedPhone,
              question: nextQuestion,
              channel,
              requestId: request.id,
            });

            return reply.code(201).send({
              success: true,
              status: "needs_follow_up",
              farmer: {
                id: registeredFarmer.id,
                name: registeredFarmer.name,
                preferredLanguage:
                  registeredFarmer.preferredLanguage,
              },
              farm: {
                id: farm.id,
                name: farm.name,
              },
              cropCycle: {
                id: cropCycle.id,
                crop: cropCycle.crop,
                variety: cropCycle.variety,
                currentStage: cropCycle.currentStage,
              },
              channel,
              interpretation,
              observation: answerObservation,
              conversation: pendingConversation,
              smsDelivery,
              recommendation: null,
              followUpQuestions:
                interpretation.followUpQuestions,
            });
          }

          // 1B. The clarification provides enough information.
          await pendingConversation.update({
            answer: normalizedMessage,
            answerObservationId: answerObservation.id,
            status: "completed",
            completedAt: new Date(),
          });

          const recommendation = await generateRecommendation(
            cropCycle.id,
            answerObservation.id
          );

          const farmerSms = await sendRecommendationSms({
            phone: normalizedPhone,
            recommendation,
            language: preferredLanguage,
            channel,
            requestId: request.id,
          });

          return reply.code(201).send({
            success: true,
            status: "processed",
            conversationStatus: "completed",
            farmer: {
              id: registeredFarmer.id,
              name: registeredFarmer.name,
              preferredLanguage:
                registeredFarmer.preferredLanguage,
            },
            farm: {
              id: farm.id,
              name: farm.name,
            },
            cropCycle: {
              id: cropCycle.id,
              crop: cropCycle.crop,
              variety: cropCycle.variety,
              currentStage: cropCycle.currentStage,
            },
            channel,
            interpretation,
            observation: answerObservation,
            conversation: pendingConversation,
            recommendation,
            farmerSms,
            followUpQuestions: [],
          });
        }
      }

      // 2. No pending conversation: process a new message.
      const context = await resolveFarmerContext(normalizedPhone);

      if (context.status === "not_found") {
        return reply.code(404).send({
          success: false,
          status: "not_registered",
          message:
            "Farmer is not registered. Start the AgriMama onboarding process.",
        });
      }

      if (context.status === "no_farm") {
        return reply.code(409).send({
          success: false,
          status: "no_farm",
          message:
            "Your AgriMama profile exists, but no farm has been registered yet.",
        });
      }

      if (context.status === "ambiguous") {
        return reply.code(409).send({
          success: false,
          status: "needs_clarification",
          message:
            "You have more than one active farm or crop. AgriMama needs to know which farm or crop you are referring to.",
          farms: context.farms.map((farm) => ({
            id: farm.id,
            name: farm.name,
          })),
          cropCycles: context.cropCycles.map((cropCycle) => ({
            id: cropCycle.id,
            farmId: cropCycle.farmId,
            crop: cropCycle.crop,
            variety: cropCycle.variety,
            currentStage: cropCycle.currentStage,
          })),
        });
      }

      if (context.status === "no_active_crop") {
        return reply.code(409).send({
          success: false,
          status: "no_active_crop",
          message:
            "Your farm is registered, but there is no active crop cycle yet.",
        });
      }

      const farmer = context.farmer;
      const farm = context.farm;
      const cropCycle = context.cropCycle;

      const preferredLanguage =
        language || farmer.preferredLanguage || "en";

      const interpretation = await interpretFarmerMessage(
        normalizedMessage,
        {
          crop: cropCycle.crop,
          growthStage: cropCycle.currentStage,
          language: preferredLanguage,
        }
      );

      // Save the new farmer message as an observation.
      const observation = await FarmerObservation.create({
        farmerId: farmer.id,
        farmId: farm.id,
        cropCycleId: cropCycle.id,
        category: interpretation.category,
        observation: normalizedMessage,
        observedAt: new Date(),
        source: "ai_interpreted",
        language: preferredLanguage,
      });

      // 2A. Ask a clarification question when needed.
      if (interpretation.needsFollowUp) {
        const question =
          interpretation.followUpQuestions?.[0];

        if (!question) {
          throw new Error(
            "The interpreter requested follow-up but returned no question."
          );
        }

        const conversation = await Conversation.create({
          farmerId: farmer.id,
          farmId: farm.id,
          cropCycleId: cropCycle.id,
          observationId: observation.id,
          question,
          status: "awaiting_reply",
          askedAt: new Date(),
        });

        const smsDelivery = await sendClarificationSms({
          phone: normalizedPhone,
          question,
          channel,
          requestId: request.id,
        });

        return reply.code(201).send({
          success: true,
          status: "needs_follow_up",
          farmer: {
            id: farmer.id,
            name: farmer.name,
            preferredLanguage: farmer.preferredLanguage,
          },
          farm: {
            id: farm.id,
            name: farm.name,
          },
          cropCycle: {
            id: cropCycle.id,
            crop: cropCycle.crop,
            variety: cropCycle.variety,
            currentStage: cropCycle.currentStage,
          },
          channel,
          interpretation,
          observation,
          conversation,
          smsDelivery,
          recommendation: null,
          followUpQuestions:
            interpretation.followUpQuestions,
        });
      }

      // 2B. The initial message is sufficiently clear.
      const recommendation = await generateRecommendation(
        cropCycle.id,
        observation.id
      );

      const farmerSms = await sendRecommendationSms({
        phone: normalizedPhone,
        recommendation,
        language: preferredLanguage,
        channel,
        requestId: request.id,
      });

      return reply.code(201).send({
        success: true,
        status: "processed",
        farmer: {
          id: farmer.id,
          name: farmer.name,
          preferredLanguage: farmer.preferredLanguage,
        },
        farm: {
          id: farm.id,
          name: farm.name,
        },
        cropCycle: {
          id: cropCycle.id,
          crop: cropCycle.crop,
          variety: cropCycle.variety,
          currentStage: cropCycle.currentStage,
        },
        channel,
        interpretation,
        observation,
        recommendation,
        farmerSms,
        followUpQuestions: [],
      });
    } catch (error) {
      request.log.error(error);

      return reply.code(500).send({
        success: false,
        error: "Failed to process farmer message.",
        message: error.message,
      });
    }
  });
}
