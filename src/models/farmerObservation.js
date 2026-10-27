import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";
import Farmer from "./farmer.js";
import Farm from "./farm.js";
import CropCycle from "./cropCycle.js";

const FarmerObservation = sequelize.define(
  "FarmerObservation",
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
      allowNull: true,
      references: {
        model: CropCycle,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },

    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    observation: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    observedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    source: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "farmer",
    },

    language: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    tableName: "farmer_observations",
    timestamps: true,
    underscored: true,
  }
);

Farmer.hasMany(FarmerObservation, {
  foreignKey: "farmerId",
  as: "observations",
});

FarmerObservation.belongsTo(Farmer, {
  foreignKey: "farmerId",
  as: "farmer",
});

Farm.hasMany(FarmerObservation, {
  foreignKey: "farmId",
  as: "observations",
});

FarmerObservation.belongsTo(Farm, {
  foreignKey: "farmId",
  as: "farm",
});

CropCycle.hasMany(FarmerObservation, {
  foreignKey: "cropCycleId",
  as: "observations",
});

FarmerObservation.belongsTo(CropCycle, {
  foreignKey: "cropCycleId",
  as: "cropCycle",
});

export default FarmerObservation;