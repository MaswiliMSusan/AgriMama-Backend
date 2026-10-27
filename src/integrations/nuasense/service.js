import "dotenv/config";

import WeatherStation from "../../models/weatherStation.js";
import WeatherObservation from "../../models/weatherObservation.js";

import { getFarmWeather } from "./client.js";
import { mapWeatherObservation } from "./mapper.js";

const DEFAULT_PROVIDER = "nuasense";

export async function syncWeatherData({
  gatewayId = process.env.NUASENSE_GATEWAY_ID,
  start = "-24h",
} = {}) {
  if (!gatewayId) {
    throw new Error("NUASENSE_GATEWAY_ID is not configured.");
  }

  console.log(
    `Syncing NuaSense weather data for gateway ${gatewayId}...`
  );

  // 1. Fetch data from NuaSense
  const response = await getFarmWeather({
    gatewayId,
    start,
  });

  if (!response?.rows || !Array.isArray(response.rows)) {
    throw new Error("Unexpected NuaSense response: rows are missing.");
  }

  console.log(`NuaSense returned ${response.rows.length} rows`);

  // 2. Find or create the weather station
  const [weatherStation] = await WeatherStation.findOrCreate({
    where: {
      gatewayId,
    },
    defaults: {
      provider: DEFAULT_PROVIDER,
      gatewayId,
      latitude: null,
      longitude: null,
      active: true,
    },
  });

  console.log(`Weather station ID: ${weatherStation.id}`);

  // 3. Map only rows that contain actual weather measurements
  const observations = [];

  let skippedRows = 0;

  for (const row of response.rows) {
    const hasWeatherData = [
      row.temperature,
      row.humidity,
      row.pressure,
      row.rainfall,
      row.wind_speed,
      row.wind_gusts,
      row.wind_direction,
    ].some((value) => value !== null && value !== undefined);

    if (!hasWeatherData) {
      skippedRows++;
      continue;
    }

    const mapped = mapWeatherObservation(row);

    observations.push({
      weatherStationId: weatherStation.id,
      ...mapped,
    });
  }

  console.log(`Valid weather observations: ${observations.length}`);
  console.log(`Skipped incomplete rows: ${skippedRows}`);

  if (observations.length === 0) {
    console.log("No valid weather observations to save.");
    return {
      weatherStationId: weatherStation.id,
      received: response.rows.length,
      saved: 0,
      skipped: skippedRows,
    };
  }

  // 4. Save observations
  const existingCount = await WeatherObservation.count({
  where: {
    weatherStationId: weatherStation.id,
  },
});

const saved = await WeatherObservation.bulkCreate(observations, {
  ignoreDuplicates: true,
});

const newCount = await WeatherObservation.count({
  where: {
    weatherStationId: weatherStation.id,
  },
});

const inserted = newCount - existingCount;
const duplicates = observations.length - inserted;

console.log(`New observations inserted: ${inserted}`);
console.log(`Duplicate observations ignored: ${duplicates}`);

return {
  weatherStationId: weatherStation.id,
  received: response.rows.length,
  valid: observations.length,
  skipped: skippedRows,
  inserted,
  duplicates,
};
}