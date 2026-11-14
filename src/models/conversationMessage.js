
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";
import Conversation from "./conversation.js";

const ConversationMessage = sequelize.define(
  "ConversationMessage",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    conversationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Conversation,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },

    sender: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [["farmer", "assistant"]],
      },
    },

    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    channel: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "dashboard",
      validate: {
        isIn: [["dashboard", "sms"]],
      },
    },
  },
  {
    tableName: "conversation_messages",
    timestamps: true,
    underscored: true,
  }
);

// Conversation relationships
Conversation.hasMany(ConversationMessage, {
  foreignKey: "conversationId",
  as: "messages",
});

ConversationMessage.belongsTo(Conversation, {
  foreignKey: "conversationId",
  as: "conversation",
});

export default ConversationMessage;
