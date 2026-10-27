import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Farmer = sequelize.define(
  "Farmer",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },

    phone: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true,
    },

    preferredLanguage: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "dholuo",
    },

    consentStatus: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    consentAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "farmers",
    timestamps: true,
    underscored: true,
  }
);

export default Farmer;