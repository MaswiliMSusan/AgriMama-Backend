import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

import Farmer from "./farmer.js";
import Farm from "./farm.js";
import CropCycle from "./cropCycle.js";
import FarmerObservation from "./farmerObservation.js";

const Recommendation = sequelize.define(
  "Recommendation",
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
      allowNull: true,
      references: {
        model: FarmerObservation,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },

    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "action",
    },

    actionCode: {
    type: DataTypes.STRING(100),
    allowNull: true,
    },

    recommendation: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    priority: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "normal",
    },

    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "pending",
    },

    source: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    language: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    requiresHumanReview: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    reviewedBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "recommendations",
    timestamps: true,
    underscored: true,
  }
);

// Farmer relationships
Farmer.hasMany(Recommendation, {
  foreignKey: "farmerId",
  as: "recommendations",
});

Recommendation.belongsTo(Farmer, {
  foreignKey: "farmerId",
  as: "farmer",
});

// Farm relationships
Farm.hasMany(Recommendation, {
  foreignKey: "farmId",
  as: "recommendations",
});

Recommendation.belongsTo(Farm, {
  foreignKey: "farmId",
  as: "farm",
});

// Crop cycle relationships
CropCycle.hasMany(Recommendation, {
  foreignKey: "cropCycleId",
  as: "recommendations",
});

Recommendation.belongsTo(CropCycle, {
  foreignKey: "cropCycleId",
  as: "cropCycle",
});

// Farmer observation relationship
FarmerObservation.hasMany(Recommendation, {
  foreignKey: "observationId",
  as: "recommendations",
});

Recommendation.belongsTo(FarmerObservation, {
  foreignKey: "observationId",
  as: "observation",
});

export default Recommendation;