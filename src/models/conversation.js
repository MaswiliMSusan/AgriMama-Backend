
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

import Farmer from "./farmer.js";
import Farm from "./farm.js";
import CropCycle from "./cropCycle.js";
import FarmerObservation from "./farmerObservation.js";

const Conversation = sequelize.define(
  "Conversation",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    farmerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Farmer,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },

    farmId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Farm,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },

    cropCycleId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: CropCycle,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },

    observationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: FarmerObservation,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },

    question: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    answer: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    answerObservationId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: FarmerObservation,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },

    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "awaiting_reply",
      validate: {
        isIn: [["awaiting_reply", "completed", "cancelled"]],
      },
    },

    askedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "conversations",
    timestamps: true,
    underscored: true,
  }
);

// Farmer relationships
Farmer.hasMany(Conversation, {
  foreignKey: "farmerId",
  as: "conversations",
});

Conversation.belongsTo(Farmer, {
  foreignKey: "farmerId",
  as: "farmer",
});

// Farm relationships
Farm.hasMany(Conversation, {
  foreignKey: "farmId",
  as: "conversations",
});

Conversation.belongsTo(Farm, {
  foreignKey: "farmId",
  as: "farm",
});

// Crop cycle relationships
CropCycle.hasMany(Conversation, {
  foreignKey: "cropCycleId",
  as: "conversations",
});

Conversation.belongsTo(CropCycle, {
  foreignKey: "cropCycleId",
  as: "cropCycle",
});

// Original observation that triggered the question
FarmerObservation.hasMany(Conversation, {
  foreignKey: "observationId",
  as: "triggeredConversations",
});

Conversation.belongsTo(FarmerObservation, {
  foreignKey: "observationId",
  as: "originalObservation",
});

// Observation created from the farmer's reply
FarmerObservation.hasMany(Conversation, {
  foreignKey: "answerObservationId",
  as: "answeredConversations",
});

Conversation.belongsTo(FarmerObservation, {
  foreignKey: "answerObservationId",
  as: "answerObservation",
});

export default Conversation;
