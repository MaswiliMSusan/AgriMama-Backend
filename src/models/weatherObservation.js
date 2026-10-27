import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";
import WeatherStation from "./weatherStation.js";

const WeatherObservation = sequelize.define(
  "WeatherObservation",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    weatherStationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: WeatherStation,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },

    recordedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    temperature: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
    },

    humidity: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
    },

    pressure: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },

    rainfall: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },

    windSpeed: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: true,
    },

    windGusts: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: true,
    },

    windDirection: {
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

    batteryPercent: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
    },
  },
  {
    tableName: "weather_observations",
    timestamps: true,
    underscored: true,
  }
);

WeatherStation.hasMany(WeatherObservation, {
  foreignKey: "weatherStationId",
  as: "observations",
});

WeatherObservation.belongsTo(WeatherStation, {
  foreignKey: "weatherStationId",
  as: "weatherStation",
});

export default WeatherObservation;