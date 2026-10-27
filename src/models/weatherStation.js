import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const WeatherStation = sequelize.define(
  "WeatherStation",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    provider: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "nuasense",
    },

    gatewayId: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },

    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },

    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },

    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "weather_stations",
    timestamps: true,
    underscored: true,
  }
);

export default WeatherStation;