import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";
import Farmer from "./farmer.js";

const Farm = sequelize.define(
  "Farm",
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

    name: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },

    sizeAcres: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },

    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },

    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },

    locationAccuracyMeters: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
  },
  {
    tableName: "farms",
    timestamps: true,
    underscored: true,
  }
);

Farmer.hasMany(Farm, {
  foreignKey: "farmerId",
  as: "farms",
});

Farm.belongsTo(Farmer, {
  foreignKey: "farmerId",
  as: "farmer",
});

export default Farm;