import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";
import Farm from "./farm.js";
import WeatherStation from "./weatherStation.js";

const FarmWeatherStation = sequelize.define(
  "FarmWeatherStation",
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

    activeFrom: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    activeTo: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "farm_weather_stations",
    timestamps: true,
    underscored: true,
  }
);

Farm.belongsToMany(WeatherStation, {
  through: FarmWeatherStation,
  foreignKey: "farmId",
  otherKey: "weatherStationId",
  as: "weatherStations",
});

WeatherStation.belongsToMany(Farm, {
  through: FarmWeatherStation,
  foreignKey: "weatherStationId",
  otherKey: "farmId",
  as: "farms",
});

FarmWeatherStation.belongsTo(Farm, {
  foreignKey: "farmId",
  as: "farm",
});

FarmWeatherStation.belongsTo(WeatherStation, {
  foreignKey: "weatherStationId",
  as: "weatherStation",
});

export default FarmWeatherStation;