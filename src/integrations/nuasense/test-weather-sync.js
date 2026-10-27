import "dotenv/config";

import WeatherObservation from "../../models/weatherObservation.js";
import { syncWeatherData } from "./service.js";

async function run() {
  console.log("Testing REAL NuaSense → PostgreSQL ingestion...\n");

  try {
    const gatewayId = process.env.NUASENSE_GATEWAY_ID;

    if (!gatewayId) {
      throw new Error(
        "NUASENSE_GATEWAY_ID is not configured."
      );
    }

    console.log("Gateway:", gatewayId);

    // Count observations before sync
    const beforeCount = await WeatherObservation.count();

    console.log(
      `Weather observations before sync: ${beforeCount}`
    );

    // --------------------------------------------------
    // Run the actual NuaSense synchronization
    // --------------------------------------------------
    const result = await syncWeatherData({
      gatewayId,
      start: "-24h",
    });

    console.log("SYNC RESULT:");
    console.dir(result, { depth: null });

    // Count observations after sync
    const afterCount = await WeatherObservation.count();

    console.log(
      `\nWeather observations after sync: ${afterCount}`
    );

    // --------------------------------------------------
    // Validate result
    // --------------------------------------------------
    if (!result) {
      throw new Error(
        "syncWeatherData() returned no result."
      );
    }

    if (result.received <= 0) {
      throw new Error(
        "NuaSense returned no rows."
      );
    }

    if (result.valid <= 0) {
      throw new Error(
        "No valid weather observations were found."
      );
    }

    if (!result.weatherStationId) {
      throw new Error(
        "No weather station ID was returned."
      );
    }

    // --------------------------------------------------
    // Verify database records
    // --------------------------------------------------
    const latestObservations =
      await WeatherObservation.findAll({
        where: {
          weatherStationId: result.weatherStationId,
        },
        order: [["recordedAt", "DESC"]],
        limit: 5,
      });

    console.log(
      "LATEST DATABASE OBSERVATIONS:"
    );

    console.dir(
      latestObservations.map((observation) =>
        observation.toJSON()
      ),
      { depth: null }
    );

    if (latestObservations.length === 0) {
      throw new Error(
        "No weather observations found in the database."
      );
    }

    const latest = latestObservations[0];

    if (!latest.recordedAt) {
      throw new Error(
        "Latest observation has no recordedAt value."
      );
    }

    // At least one weather field should contain data.
    const hasWeatherValue = [
      latest.temperature,
      latest.humidity,
      latest.pressure,
      latest.rainfall,
      latest.windSpeed,
      latest.windGusts,
      latest.windDirection,
    ].some(
      (value) =>
        value !== null &&
        value !== undefined
    );

    if (!hasWeatherValue) {
      throw new Error(
        "Latest database observation contains no weather measurements."
      );
    }

    console.log(
      "Real NuaSense data successfully reached PostgreSQL."
    );

    console.log(
      "NuaSense → Mapper → WeatherObservation verified."
    );

    console.log(
      "REAL NuaSense WEATHER SYNC TEST PASSED!"
    );

  } catch (error) {
    console.error(
      "NuaSense weather sync test failed."
    );

    console.error(error);

    process.exitCode = 1;
  }
}

run();