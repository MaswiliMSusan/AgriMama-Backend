import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";
import Farm from "./farm.js";

const CropCycle = sequelize.define(
  "CropCycle",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
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

    crop: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "maize",
    },

    variety: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },

    plantingDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    currentStage: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "active",
    },
  },
  {
    tableName: "crop_cycles",
    timestamps: true,
    underscored: true,
  }
);

Farm.hasMany(CropCycle, {
  foreignKey: "farmId",
  as: "cropCycles",
});

CropCycle.belongsTo(Farm, {
  foreignKey: "farmId",
  as: "farm",
});

export default CropCycle;