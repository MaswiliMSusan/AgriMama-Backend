import "dotenv/config";

import sequelize from "../../config/database.js";

import Farmer from "../../models/farmer.js";
import Farm from "../../models/farm.js";
import CropCycle from "../../models/cropCycle.js";
import FarmerObservation from "../../models/farmerObservation.js";
import Recommendation from "../../models/recommendation.js";
import WeatherStation from "../../models/weatherStation.js";
import FarmWeatherStation from "../../models/farmWeatherStation.js";

import { buildDecisionContext } from "../../services/decisionContext.js";
import { generateRecommendation } from "../../services/decisionEngine.js";

let farmer;
let farm;
let cropCycle;
let observation;
let recommendation;
let farmWeatherStation;

try {
  console.log("Testing AgriMama context-aware decision engine...\n");

  // --------------------------------------------------
  // 1. Create test farmer
  // --------------------------------------------------

  farmer = await Farmer.create({
    name: "Decision Engine Test Farmer",
    phone: `2547${Date.now().toString().slice(-8)}`,
    preferredLanguage: "dholuo",
    consentStatus: true,
    consentAt: new Date(),
  });

  console.log(`Farmer: ${farmer.id}`);

  // --------------------------------------------------
  // 2. Create test farm
  // --------------------------------------------------

  farm = await Farm.create({
    farmerId: farmer.id,
    name: "Decision Engine Test Farm",
    sizeAcres: 1,
    latitude: 0.718996,
    longitude: 35.156639,
    locationAccuracyMeters: 10,
  });

  console.log(`Farm: ${farm.id}`);

  // --------------------------------------------------
  // 3. Create test crop cycle
  // --------------------------------------------------

  cropCycle = await CropCycle.create({
    farmId: farm.id,
    crop: "sweet_potato",
    variety: "Test Variety",
    plantingDate: "2026-09-01",
    currentStage: "vegetative_growth",
    status: "active",
  });

  console.log(`Crop cycle: ${cropCycle.id}`);

  // --------------------------------------------------
  // 4. Find existing NuaSense weather station
  // --------------------------------------------------

  console.log("Finding NuaSense weather station...");

  const gatewayId = process.env.NUASENSE_GATEWAY_ID;

  if (!gatewayId) {
    throw new Error(
      "NUASENSE_GATEWAY_ID is not configured in your .env file."
    );
  }

  const weatherStation = await WeatherStation.findOne({
    where: {
      gatewayId,
    },
  });

  if (!weatherStation) {
    throw new Error(
      `No weather station found for gateway ${gatewayId}.`
    );
  }

  console.log(`Weather station: ${weatherStation.id}`);

  // --------------------------------------------------
  // 5. Link farm to weather station
  // --------------------------------------------------

  console.log("Linking farm to weather station...");

  farmWeatherStation = await FarmWeatherStation.create({
    farmId: farm.id,
    weatherStationId: weatherStation.id,
    activeFrom: new Date(),
    active: true,
  });

  console.log(
    `Farm-weather relationship: ${farmWeatherStation.id}`
  );

  // --------------------------------------------------
  // 6. Create farmer observation
  // --------------------------------------------------

  observation = await FarmerObservation.create({
    farmerId: farmer.id,
    farmId: farm.id,
    cropCycleId: cropCycle.id,
    category: "crop_health",
    observation:
      "My sweet potato leaves are being eaten by insects.",
    observedAt: new Date(),
    source: "farmer",
    language: "en",
  });

  console.log(`Observation: ${observation.id}`);

  // --------------------------------------------------
  // 7. Build decision context
  // --------------------------------------------------

  console.log("Building decision context...\n");

  const context = await buildDecisionContext(cropCycle.id);

  console.log("CONTEXT SUMMARY:");

  console.log(`   Farmer: ${context.farmer?.name}`);
  console.log(`   Farm: ${context.farm?.name}`);
  console.log(`   Crop: ${context.cropCycle?.crop}`);
  console.log(`   Growth stage: ${context.cropCycle?.currentStage}`);
  console.log(
    `   Observations: ${context.observations?.length || 0}`
  );
  console.log(
    `   Weather stations: ${context.weatherStations?.length || 0}`
  );
  console.log(
    `   Weather observations: ${context.weather?.length || 0}`
  );

  // --------------------------------------------------
  // 8. Verify weather context exists
  // --------------------------------------------------

  if (!context.weatherStations?.length) {
    throw new Error(
      "No weather station was included in the decision context."
    );
  }

  if (!context.weather?.length) {
    throw new Error(
      "No weather observations were included in the decision context."
    );
  }

  const latestWeather = context.weather[0];

  console.log("LATEST WEATHER:");

  console.log(`   Recorded: ${latestWeather.recordedAt}`);
  console.log(`   Temperature: ${latestWeather.temperature}`);
  console.log(`   Humidity: ${latestWeather.humidity}`);
  console.log(`   Rainfall: ${latestWeather.rainfall}`);
  console.log(`   Wind speed: ${latestWeather.windSpeed}`);
  console.log(`   Wind gusts: ${latestWeather.windGusts}`);

  // --------------------------------------------------
  // 9. Generate recommendation
  // --------------------------------------------------

  console.log("Generating recommendation...\n");

  recommendation = await generateRecommendation(
    cropCycle.id
  );

  console.log("GENERATED RECOMMENDATION:");

  console.log(
    JSON.stringify(
      recommendation,
      (key, value) => {
        if (value instanceof Date) {
          return value.toISOString();
        }

        return value;
      },
      2
    )
  );

  // --------------------------------------------------
  // 10. Validate recommendation
  // --------------------------------------------------

  if (!recommendation) {
    throw new Error(
      "Decision engine did not return a recommendation."
    );
  }

  if (recommendation.observationId !== observation.id) {
    throw new Error(
      "Recommendation is not linked to the correct observation."
    );
  }

  if (recommendation.farmerId !== farmer.id) {
    throw new Error(
      "Recommendation is not linked to the correct farmer."
    );
  }

  if (recommendation.farmId !== farm.id) {
    throw new Error(
      "Recommendation is not linked to the correct farm."
    );
  }

  if (recommendation.cropCycleId !== cropCycle.id) {
    throw new Error(
      "Recommendation is not linked to the correct crop cycle."
    );
  }

  if (recommendation.type !== "inspection") {
    throw new Error(
      `Expected recommendation type "inspection", received "${recommendation.type}".`
    );
  }

  if (recommendation.status !== "pending") {
    throw new Error(
      `Expected status "pending", received "${recommendation.status}".`
    );
  }

  if (recommendation.requiresHumanReview !== true) {
    throw new Error(
      "Recommendation should require human review."
    );
  }

  // --------------------------------------------------
  // 11. Verify weather was used by the decision engine
  // --------------------------------------------------

  if (
    !recommendation.reason?.includes("Recent weather information")
  ) {
    throw new Error(
      "The recommendation reason does not contain the expected weather context."
    );
  }

  console.log(
    "Weather context was successfully used by the decision engine."
  );

  console.log("Context-aware decision engine test passed!");
} catch (error) {
  console.error("Context-aware decision engine test failed:");
  console.error(error);
  process.exitCode = 1;
} finally {
  // --------------------------------------------------
  // 12. Cleanup
  // --------------------------------------------------

  console.log("Cleaning up test data...");

  try {
    if (recommendation) {
      await recommendation.destroy();
      console.log("Test recommendation removed.");
    }

    if (observation) {
      await observation.destroy();
      console.log("Test observation removed.");
    }

    if (farmWeatherStation) {
      await farmWeatherStation.destroy();
      console.log("Test farm-weather relationship removed.");
    }

    if (cropCycle) {
      await cropCycle.destroy();
      console.log("Test crop cycle removed.");
    }

    if (farm) {
      await farm.destroy();
      console.log("Test farm removed.");
    }

    if (farmer) {
      await farmer.destroy();
      console.log("Test farmer removed.");
    }
  } catch (cleanupError) {
    console.error("Cleanup failed:");
    console.error(cleanupError);
  }

  await sequelize.close();
}