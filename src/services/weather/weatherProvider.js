
import { getOpenMeteoWeather } from "./openMeteo.js";

/**
 * Retrieves optional weather context for a farm.
 *
 * Weather is supplementary. Missing coordinates or a provider
 * failure must not prevent AgriMama from processing observations.
 */
export async function getWeatherForFarm(farm) {
  if (!farm) {
    return {
      available: false,
      reason: "farm_not_provided",
      sources: [],
    };
  }

  const latitude = Number(farm.latitude);
  const longitude = Number(farm.longitude);

  if (
    farm.latitude === null ||
    farm.latitude === undefined ||
    farm.longitude === null ||
    farm.longitude === undefined ||
    farm.latitude === "" ||
    farm.longitude === "" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return {
      available: false,
      reason: "farm_coordinates_missing_or_invalid",
      sources: [],
    };
  }

  try {
    const weather = await getOpenMeteoWeather({
      latitude,
      longitude,
    });

    return {
      available: true,
      sources: [weather],
    };
  } catch (error) {
    console.error("Weather provider error:", error.message);

    return {
      available: false,
      reason: "weather_provider_unavailable",
      sources: [],
    };
  }
}
