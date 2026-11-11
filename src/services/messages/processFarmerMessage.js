import { resolveFarmerContext } from "../farmerContext.js";
import { interpretFarmerMessage } from "../ai/interpreter.js";
import { generateRecommendation } from "../decisionEngine.js";
import { sendFarmerSms } from "../sms/sendFarmerSms.js";
import { getFarmerResponse } from "../responses/farmerResponses.js";

import Farmer from "../../models/farmer.js";
import Farm from "../../models/farm.js";
import CropCycle from "../../models/cropCycle.js";
import FarmerObservation from "../../models/farmerObservation.js";
import Conversation from "../../models/conversation.js";

export async function processFarmerMessage({
  fastify,
  phone,
  message,
  language,
  source,
  authenticatedUser,
  targetFarmerId,
  requestId,
}) {
  async function sendRecommendationSms({
    phone,
    recommendation,
    language,
    channel,
    requestId,
    consentStatus,
  }) {
    if (consentStatus !== true) {
      return {
        status: "not_sent",
        reason: "farmer_consent_not_granted",
      };
    }

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

  async function sendClarificationSms({
    phone,
    question,
    channel,
    requestId,
    consentStatus,
  }) {
    if (consentStatus !== true) {
      return {
        enabled: false,
        success: false,
        status: "not_sent",
        reason: "farmer_consent_not_granted",
      };
    }

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

    try {
      if (typeof message !== "string" || !message.trim()) {
        return { statusCode: 400, body: {
          success: false, error: "message is required.",
        } };
      }

      // Only server-side entry points may select a source. HTTP clients
      // must never pass their request body directly into this service.
      if (source !== "sms_webhook" && source !== "dashboard") {
        return { statusCode: 403, body: {
          success: false, error: "Untrusted message source.",
        } };
      }

      let normalizedPhone;
      const channel = source === "sms_webhook" ? "sms" : "dashboard";

      if (source === "sms_webhook") {
        if (typeof phone !== "string" || !phone.trim()) {
          return { statusCode: 400, body: {
            success: false, error: "phone is required for inbound SMS.",
          } };
        }
        normalizedPhone = phone.trim();
      } else {
        if (!authenticatedUser?.isActive ||
            !["farmer", "staff", "admin"].includes(authenticatedUser.role)) {
          return { statusCode: 403, body: {
            success: false, error: "Not authorized.",
          } };
        }

        let farmer;
        if (authenticatedUser.role === "farmer") {
          if (!authenticatedUser.farmerId ||
              (targetFarmerId && targetFarmerId !== authenticatedUser.farmerId)) {
            return { statusCode: 403, body: {
              success: false, error: "Farmer access denied.",
            } };
          }
          farmer = await Farmer.findByPk(authenticatedUser.farmerId);
        } else {
          if (typeof targetFarmerId !== "string" || !targetFarmerId.trim()) {
            return { statusCode: 400, body: {
              success: false, error: "targetFarmerId is required for staff requests.",
            } };
          }
          // Staff/admin role is the current authorization policy.
          // Add assignment-based checks here if staff have limited caseloads.
          farmer = await Farmer.findByPk(targetFarmerId);
        }
        if (!farmer?.phone) {
          return { statusCode: 404, body: {
            success: false, error: "Farmer profile not found.",
          } };
        }
        normalizedPhone = farmer.phone.trim();
      }

      const normalizedMessage = message.trim();

      // --------------------------------------------------
      // 1. Find registered farmer and pending conversation
      // --------------------------------------------------

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
              required: false,
            },
            {
              model: Farm,
              as: "farm",
              required: false,
            },
            {
              model: CropCycle,
              as: "cropCycle",
              required: false,
            },
          ],
          order: [["askedAt", "DESC"]],
        });

        if (pendingConversation) {
          // --------------------------------------------------
          // 1A. Handle crop-selection conversation
          // --------------------------------------------------

          if (pendingConversation.purpose === "crop_selection") {
            const metadata = pendingConversation.metadata || {};
            const stage =
              metadata.stage || "awaiting_crop_selection";

            const preferredLanguage =
              language ||
              registeredFarmer.preferredLanguage ||
              "en";

            const selection = Number(normalizedMessage.trim());

            if (stage === "awaiting_crop_selection") {
              const options = Array.isArray(metadata.options)
                ? metadata.options
                : [];

              const anotherCropOption = options.length + 1;

              if (
                !Number.isInteger(selection) ||
                selection < 1 ||
                selection > anotherCropOption
              ) {
                const retryText =
                  metadata.selectionQuestion ||
                  pendingConversation.question;

                const smsDelivery = await sendClarificationSms({
                  phone: normalizedPhone,
                  question:
                    `Please reply with a number from 1 to ${anotherCropOption}.\n${retryText}`,
                  channel,
                  requestId: requestId,
                  consentStatus: registeredFarmer.consentStatus,
                });

                return { statusCode: 200, body: {
                  success: true,
                  status: "invalid_crop_selection",
                  message: retryText,
                  smsDelivery,
                } };
              }

              // Farmer selected "Another crop".
              if (selection === anotherCropOption) {
                const nextQuestion =
                  "Which other crop are you referring to? Please type the crop name.";

                await pendingConversation.update({
                  question: nextQuestion,
                  answer: normalizedMessage,
                  askedAt: new Date(),
                  metadata: {
                    ...metadata,
                    stage: "awaiting_other_crop_name",
                  },
                });

                const smsDelivery = await sendClarificationSms({
                  phone: normalizedPhone,
                  question: nextQuestion,
                  channel,
                  requestId: requestId,
                  consentStatus: registeredFarmer.consentStatus,
                });

                return { statusCode: 200, body: {
                  success: true,
                  status: "needs_crop_name",
                  message: nextQuestion,
                  smsDelivery,
                } };
              }

              // Farmer selected a registered crop cycle.
              const selectedOption = options[selection - 1];

              if (
                !selectedOption?.cropCycleId ||
                !selectedOption?.farmId
              ) {
                throw new Error(
                  "The selected crop option is no longer available."
                );
              }

              const farm = await Farm.findByPk(
                selectedOption.farmId
              );

              const cropCycle = await CropCycle.findByPk(
                selectedOption.cropCycleId
              );

              if (
                !farm ||
                !cropCycle ||
                farm.farmerId !== registeredFarmer.id ||
                cropCycle.farmId !== farm.id ||
                cropCycle.status !== "active"
              ) {
                return { statusCode: 409, body: {
                  success: false,
                  status: "crop_option_unavailable",
                  message:
                    "That crop cycle is no longer active. Please send your report again.",
                } };
              }

              const originalMessage = metadata.originalMessage;

              if (!originalMessage) {
                throw new Error(
                  "The original farmer message is missing from the crop-selection conversation."
                );
              }

              const interpretation =
                await interpretFarmerMessage(originalMessage, {
                  crop: cropCycle.crop,
                  growthStage: cropCycle.currentStage,
                  language: preferredLanguage,
                });

              const observation = await FarmerObservation.create({
                farmerId: registeredFarmer.id,
                farmId: farm.id,
                cropCycleId: cropCycle.id,
                category: interpretation.category,
                observation: originalMessage,
                observedAt: new Date(),
                source: "ai_interpreted",
                language: preferredLanguage,
              });

              // AI needs additional clarification.
              if (interpretation.needsFollowUp) {
                const nextQuestion =
                  interpretation.followUpQuestions?.[0];

                if (!nextQuestion) {
                  throw new Error(
                    "The interpreter requested follow-up but returned no question."
                  );
                }

                await pendingConversation.update({
                  farmId: farm.id,
                  cropCycleId: cropCycle.id,
                  observationId: observation.id,
                  purpose: "observation_clarification",
                  question: nextQuestion,
                  answer: null,
                  answerObservationId: null,
                  status: "awaiting_reply",
                  askedAt: new Date(),
                  completedAt: null,
                  metadata: {
                    selectedCropCycleId: cropCycle.id,
                  },
                });

                const smsDelivery = await sendClarificationSms({
                  phone: normalizedPhone,
                  question: nextQuestion,
                  channel,
                  requestId: requestId,
                  consentStatus: registeredFarmer.consentStatus,
                });

                return { statusCode: 201, body: {
                  success: true,
                  status: "needs_follow_up",
                  farmer: {
                    id: registeredFarmer.id,
                    name: registeredFarmer.name,
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
                  interpretation,
                  observation,
                  conversation: pendingConversation,
                  smsDelivery,
                  recommendation: null,
                  followUpQuestions:
                    interpretation.followUpQuestions,
                } };
              }

              // AI has enough information.
              await pendingConversation.update({
                farmId: farm.id,
                cropCycleId: cropCycle.id,
                observationId: observation.id,
                purpose: "observation_clarification",
                status: "completed",
                completedAt: new Date(),
                metadata: {
                  selectedCropCycleId: cropCycle.id,
                },
              });

              const recommendation =
                await generateRecommendation(
                  cropCycle.id,
                  observation.id
                );

              const farmerSms = await sendRecommendationSms({
                phone: normalizedPhone,
                recommendation,
                language: preferredLanguage,
                channel,
                requestId: requestId,
                consentStatus: registeredFarmer.consentStatus,
              });

              return { statusCode: 201, body: {
                success: true,
                status: "processed",
                conversationStatus: "completed",
                farmer: {
                  id: registeredFarmer.id,
                  name: registeredFarmer.name,
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
                interpretation,
                observation,
                conversation: pendingConversation,
                recommendation,
                farmerSms,
                followUpQuestions: [],
              } };
            }

            // --------------------------------------------------
            // 1B. Farmer selected "Another crop"
            // --------------------------------------------------

            if (stage === "awaiting_other_crop_name") {
              const farms = await Farm.findAll({
                where: {
                  farmerId: registeredFarmer.id,
                },
                order: [["createdAt", "ASC"]],
              });

              if (farms.length !== 1) {
                const question =
                  "Please contact AgriMama support to register the farm for this crop before reporting it.";

                await pendingConversation.update({
                  status: "completed",
                  completedAt: new Date(),
                  answer: normalizedMessage,
                });

                return { statusCode: 200, body: {
                  success: true,
                  status: "crop_registration_required",
                  message: question,
                } };
              }

              // Record the farmer's report for registration review.
              // No crop-specific recommendation is generated here.
              const observation = await FarmerObservation.create({
                farmerId: registeredFarmer.id,
                farmId: farms[0].id,
                cropCycleId: null,
                category: "general",
                observation:
                  `${metadata.originalMessage || ""}\nAdditional crop reported by farmer: ${normalizedMessage}`.trim(),
                observedAt: new Date(),
                source: "farmer",
                language: preferredLanguage,
              });

              await pendingConversation.update({
                farmId: farms[0].id,
                answer: normalizedMessage,
                answerObservationId: observation.id,
                status: "completed",
                completedAt: new Date(),
                metadata: {
                  ...metadata,
                  stage: "crop_registration_required",
                  reportedCrop: normalizedMessage,
                },
              });

              return { statusCode: 201, body: {
                success: true,
                status: "crop_registration_required",
                message:
                  `Thank you. We have recorded your report about ${normalizedMessage}. Please register this crop cycle before AgriMama can provide crop-specific advice.`,
                observation,
                conversation: pendingConversation,
              } };
            }
          }

          // --------------------------------------------------
          // 1C. Normal observation clarification conversation
          // --------------------------------------------------

          const farm = pendingConversation.farm;
          const cropCycle = pendingConversation.cropCycle;
          const originalObservation =
            pendingConversation.originalObservation;

          const preferredLanguage =
            language ||
            registeredFarmer.preferredLanguage ||
            "en";

          if (!farm || !cropCycle || !originalObservation ||
              farm.farmerId !== registeredFarmer.id ||
              cropCycle.farmId !== farm.id ||
              originalObservation.farmerId !== registeredFarmer.id ||
              originalObservation.cropCycleId !== cropCycle.id) {
            return { statusCode: 409, body: {
              success: false, error: "Conversation context is no longer valid.",
            } };
          }

          const observationContext = [
            originalObservation.observation,
            pendingConversation.answer
              ? `Previous farmer reply: ${pendingConversation.answer}`
              : null,
          ]
            .filter(Boolean)
            .join("\n");

          const interpretation =
            await interpretFarmerMessage(
              normalizedMessage,
              {
                crop: cropCycle.crop,
                growthStage: cropCycle.currentStage,
                language: preferredLanguage,
                originalObservation: observationContext,
                followUpQuestion: pendingConversation.question,
              }
            );

          const answerObservation =
            await FarmerObservation.create({
              farmerId: registeredFarmer.id,
              farmId: farm.id,
              cropCycleId: cropCycle.id,
              category: interpretation.category,
              observation: normalizedMessage,
              observedAt: new Date(),
              source: "farmer_reply",
              language: preferredLanguage,
            });

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
              requestId: requestId,
              consentStatus: registeredFarmer.consentStatus,
            });

            return { statusCode: 201, body: {
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
            } };
          }

          await pendingConversation.update({
            answer: normalizedMessage,
            answerObservationId: answerObservation.id,
            status: "completed",
            completedAt: new Date(),
          });

          const recommendation =
            await generateRecommendation(
              cropCycle.id,
              answerObservation.id
            );

          const farmerSms = await sendRecommendationSms({
            phone: normalizedPhone,
            recommendation,
            language: preferredLanguage,
            channel,
            requestId: requestId,
            consentStatus: registeredFarmer.consentStatus,
          });

          return { statusCode: 201, body: {
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
          } };
        }
      }

      // --------------------------------------------------
      // 2. No pending conversation: process a new message
      // --------------------------------------------------

      const context =
        await resolveFarmerContext(normalizedPhone);

      if (context.status === "not_found") {
        return { statusCode: 404, body: {
          success: false,
          status: "not_registered",
          message:
            "Farmer is not registered. Start the AgriMama onboarding process.",
        } };
      }

      if (context.status === "no_farm") {
        return { statusCode: 409, body: {
          success: false,
          status: "no_farm",
          message:
            "Your AgriMama profile exists, but no farm has been registered yet.",
        } };
      }

      // --------------------------------------------------
      // 2A. Multiple farms or crop cycles: ask for selection
      // --------------------------------------------------

      if (context.status === "ambiguous") {
        const farmsById = new Map(
          context.farms.map((farm) => [farm.id, farm])
        );

        const options = context.cropCycles.map((cropCycle) => {
          const farm = farmsById.get(cropCycle.farmId);

          const description = [
            cropCycle.crop,
            cropCycle.variety
              ? `Variety ${cropCycle.variety}`
              : null,
            cropCycle.currentStage
              ? `${cropCycle.currentStage} stage`
              : null,
            context.farms.length > 1 && farm?.name
              ? `Farm: ${farm.name}`
              : null,
          ]
            .filter(Boolean)
            .join(" – ");

          return {
            cropCycleId: cropCycle.id,
            farmId: cropCycle.farmId,
            label: description,
          };
        });

        const lines = options.map(
          (option, index) =>
            `${index + 1}. ${option.label}`
        );

        lines.push(`${options.length + 1}. Another crop`);

        const selectionQuestion =
          `Which crop are you referring to?\n${lines.join("\n")}\nReply with the number of your choice.`;

        const conversation = await Conversation.create({
          farmerId: context.farmer.id,
          farmId:
            context.farms.length === 1
              ? context.farms[0].id
              : null,
          cropCycleId: null,
          observationId: null,
          purpose: "crop_selection",
          question: selectionQuestion,
          status: "awaiting_reply",
          askedAt: new Date(),
          metadata: {
            stage: "awaiting_crop_selection",
            originalMessage: normalizedMessage,
            language:
              language ||
              context.farmer.preferredLanguage ||
              "en",
            options,
            selectionQuestion,
          },
        });

        const smsDelivery = await sendClarificationSms({
          phone: normalizedPhone,
          question: selectionQuestion,
          channel,
          requestId: requestId,
          consentStatus: context.farmer.consentStatus,
        });

        return { statusCode: 201, body: {
          success: true,
          status: "needs_crop_selection",
          message: selectionQuestion,
          farmer: {
            id: context.farmer.id,
            name: context.farmer.name,
          },
          options,
          conversation,
          smsDelivery,
        } };
      }

      if (context.status === "no_active_crop") {
        return { statusCode: 409, body: {
          success: false,
          status: "no_active_crop",
          message:
            "Your farm is registered, but there is no active crop cycle yet.",
        } };
      }

      // --------------------------------------------------
      // 3. One farm and one active crop: normal processing
      // --------------------------------------------------

      const farmer = context.farmer;
      const farm = context.farm;
      const cropCycle = context.cropCycle;

      const preferredLanguage =
        language || farmer.preferredLanguage || "en";

      const interpretation =
        await interpretFarmerMessage(
          normalizedMessage,
          {
            crop: cropCycle.crop,
            growthStage: cropCycle.currentStage,
            language: preferredLanguage,
          }
        );

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

      // AI needs additional clarification.
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
          purpose: "observation_clarification",
          question,
          status: "awaiting_reply",
          askedAt: new Date(),
        });

        const smsDelivery = await sendClarificationSms({
          phone: normalizedPhone,
          question,
          channel,
          requestId: requestId,
          consentStatus: farmer.consentStatus,
        });

        return { statusCode: 201, body: {
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
        } };
      }

      // No further clarification needed.
      const recommendation =
        await generateRecommendation(
          cropCycle.id,
          observation.id
        );

      const farmerSms = await sendRecommendationSms({
        phone: normalizedPhone,
        recommendation,
        language: preferredLanguage,
        channel,
        requestId: requestId,
        consentStatus: farmer.consentStatus,
      });

      return { statusCode: 201, body: {
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
      } };
    } catch (error) {
      fastify.log.error(error);

      return { statusCode: 500, body: {
        success: false,
        error: "Failed to process farmer message.",
      } };
    }

}
