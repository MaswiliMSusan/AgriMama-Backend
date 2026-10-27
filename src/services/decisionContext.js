
import Farmer from "../models/farmer.js";
import Farm from "../models/farm.js";
import CropCycle from "../models/cropCycle.js";
import FarmerObservation from "../models/farmerObservation.js";
import FarmWeatherStation from "../models/farmWeatherStation.js";
import WeatherStation from "../models/weatherStation.js";
import WeatherObservation from "../models/weatherObservation.js";

export async function buildDecisionContext(
  cropCycleId,
  triggeringObservationId = null
) {
  if (!cropCycleId) {
    throw new Error("cropCycleId is required.");
  }

  const cropCycle = await CropCycle.findOne({
    where: {
      id: cropCycleId,
    },
    include: [
      {
        model: Farm,
        as: "farm",
        include: [
          {
            model: Farmer,
            as: "farmer",
          },
          {
            model: WeatherStation,
            as: "weatherStations",
            through: {
              model: FarmWeatherStation,
              attributes: [
                "id",
                "activeFrom",
                "activeTo",
                "active",
              ],
            },
          },
        ],
      },
      {
        model: FarmerObservation,
        as: "observations",
        separate: true,
        order: [["observedAt", "DESC"]],
        limit: 10,
      },
    ],
  });

  if (!cropCycle) {
    throw new Error(`Crop cycle ${cropCycleId} was not found.`);
  }

  const farm = cropCycle.farm;
  const farmer = farm?.farmer;

  if (!farm) {
    throw new Error("Crop cycle is not associated with a farm.");
  }

  if (!farmer) {
    throw new Error("Farm is not associated with a farmer.");
  }

  // Validate and load the observation that triggered this decision.
  let triggeringObservation = null;

  if (triggeringObservationId) {
    triggeringObservation = await FarmerObservation.findOne({
      where: {
        id: triggeringObservationId,
        cropCycleId: cropCycle.id,
        farmerId: farmer.id,
        farmId: farm.id,
      },
    });

    if (!triggeringObservation) {
      throw new Error(
        "The triggering observation does not belong to this farmer, farm, and crop cycle."
      );
    }
  }

  // Get active weather stations linked to this farm.
  const activeStations =
    farm.weatherStations?.filter(
      (station) =>
        station.FarmWeatherStation?.active === true
    ) || [];

  // Collect recent weather observations from linked stations.
  const weather = [];

  for (const station of activeStations) {
    const weatherObservations = await WeatherObservation.findAll({
      where: {
        weatherStationId: station.id,
      },
      order: [["recordedAt", "DESC"]],
      limit: 24,
    });

    weather.push(
      ...weatherObservations.map((observation) => ({
        stationId: station.id,
        recordedAt: observation.recordedAt,
        temperature: observation.temperature,
        humidity: observation.humidity,
        pressure: observation.pressure,
        rainfall: observation.rainfall,
        windSpeed: observation.windSpeed,
        windGusts: observation.windGusts,
        windDirection: observation.windDirection,
        latitude: observation.latitude,
        longitude: observation.longitude,
        batteryPercent: observation.batteryPercent,
      }))
    );
  }

  return {
    farmer: {
      id: farmer.id,
      name: farmer.name,
      preferredLanguage: farmer.preferredLanguage,
      consentStatus: farmer.consentStatus,
    },

    farm: {
      id: farm.id,
      name: farm.name,
      sizeAcres: farm.sizeAcres,
      latitude: farm.latitude,
      longitude: farm.longitude,
    },

    cropCycle: {
      id: cropCycle.id,
      crop: cropCycle.crop,
      variety: cropCycle.variety,
      plantingDate: cropCycle.plantingDate,
      currentStage: cropCycle.currentStage,
      status: cropCycle.status,
    },

    triggeringObservation: triggeringObservation
      ? {
          id: triggeringObservation.id,
          category: triggeringObservation.category,
          observation: triggeringObservation.observation,
          observedAt: triggeringObservation.observedAt,
          source: triggeringObservation.source,
          language: triggeringObservation.language,
        }
      : null,

    observations:
      cropCycle.observations?.map((observation) => ({
        id: observation.id,
        category: observation.category,
        observation: observation.observation,
        observedAt: observation.observedAt,
        source: observation.source,
        language: observation.language,
      })) || [],

    weatherStations: activeStations.map((station) => ({
      id: station.id,
      provider: station.provider,
      gatewayId: station.gatewayId,
    })),

    weather,
  };
}
