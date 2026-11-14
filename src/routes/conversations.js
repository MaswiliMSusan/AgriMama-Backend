import Conversation from "../models/conversation.js";
import ConversationMessage from "../models/conversationMessage.js";
import Farm from "../models/farm.js";
import CropCycle from "../models/cropCycle.js";

import { authenticate } from "../middleware/authenticate.js";

export default async function conversationRoutes(fastify) {
  // GET /api/conversations/me
  // Retrieve the authenticated farmer's conversation history.
  fastify.get(
    "/conversations/me",
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const user = request.authUser;

        if (user.role !== "farmer" || !user.farmerId) {
          return reply.code(403).send({
            success: false,
            error: "This endpoint is only available to registered farmers.",
          });
        }

        const conversations = await Conversation.findAll({
          where: {
            farmerId: user.farmerId,
          },

          attributes: [
            "id",
            "purpose",
            "question",
            "answer",
            "status",
            "askedAt",
            "completedAt",
            "createdAt",
            "updatedAt",
          ],

          include: [
            {
              model: Farm,
              as: "farm",
              attributes: ["id", "name"],
              required: false,
            },
            {
              model: CropCycle,
              as: "cropCycle",
              attributes: [
                "id",
                "crop",
                "variety",
                "currentStage",
                "status",
              ],
              required: false,
            },
            {
              model: ConversationMessage,
              as: "messages",
              attributes: [
                "id",
                "sender",
                "message",
                "channel",
                "createdAt",
              ],
              separate: true,
              order: [["createdAt", "ASC"]],
            },
          ],

          order: [["updatedAt", "DESC"]],
        });

        return reply.code(200).send({
          success: true,
          count: conversations.length,
          conversations,
        });
      } catch (error) {
        request.log.error(error);

        return reply.code(500).send({
          success: false,
          error: "Failed to retrieve conversations.",
        });
      }
    }
  );

  // GET /api/conversations/:id
  // Retrieve one conversation, including its complete message history.
  fastify.get(
    "/conversations/:id",
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const user = request.authUser;

        if (user.role !== "farmer" || !user.farmerId) {
          return reply.code(403).send({
            success: false,
            error: "This endpoint is only available to registered farmers.",
          });
        }

        const { id } = request.params;

        const conversation = await Conversation.findOne({
          where: {
            id,
            farmerId: user.farmerId,
          },

          attributes: [
            "id",
            "purpose",
            "question",
            "answer",
            "status",
            "askedAt",
            "completedAt",
            "createdAt",
            "updatedAt",
          ],

          include: [
            {
              model: Farm,
              as: "farm",
              attributes: ["id", "name"],
              required: false,
            },
            {
              model: CropCycle,
              as: "cropCycle",
              attributes: [
                "id",
                "crop",
                "variety",
                "currentStage",
                "status",
              ],
              required: false,
            },
            {
              model: ConversationMessage,
              as: "messages",
              attributes: [
                "id",
                "sender",
                "message",
                "channel",
                "createdAt",
              ],
              separate: true,
              order: [["createdAt", "ASC"]],
            },
          ],
        });

        if (!conversation) {
          return reply.code(404).send({
            success: false,
            error: "Conversation not found.",
          });
        }

        return reply.code(200).send({
          success: true,
          conversation,
        });
      } catch (error) {
        request.log.error(error);

        return reply.code(500).send({
          success: false,
          error: "Failed to retrieve conversation.",
        });
      }
    }
  );
}