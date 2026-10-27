import "dotenv/config";

import Farmer from "../../models/farmer.js";
import Farm from "../../models/farm.js";
import CropCycle from "../../models/cropCycle.js";
import WeatherStation from "../../models/weatherStation.js";
import FarmWeatherStation from "../../models/farmWeatherStation.js";
import FarmerObservation from "../../models/farmerObservation.js";
import Recommendation from "../../models/recommendation.js";
import WeatherObservation from "../../models/weatherObservation.js";

import { buildDecisionContext } from "../../services/decisionContext.js";
import { evaluateRules, selectPrimaryDecision } from "../../services/ruleEngine.js";

async function run() {
  console.log(
    "Testing REAL STORED NuaSense weather → Decision Context...\n"
  );

  let farmer;
  let farm;
  let cropCycle;
  let farmWeatherStation;
  let farmerObservation;
  let recommendation;

  try {
    // --------------------------------------------------
    // 1. Find existing NuaSense weather station
    // --------------------------------------------------
    const gatewayId = process.env.NUASENSE_GATEWAY_ID;

    const weatherStation = await WeatherStation.findOne({
      where: {
        gatewayId,
      },
    });

    if (!weatherStation) {
      throw new Error(
        `Weather station for gateway ${gatewayId} was not found.`
      );
    }

    console.log(
      "Existing NuaSense station:",
      weatherStation.id
    );

    // --------------------------------------------------
    // 2. Confirm existing weather data
    // --------------------------------------------------
    const weatherCount = await WeatherObservation.count({
      where: {
        weatherStationId: weatherStation.id,
      },
    });

    console.log(
      `Stored weather observations: ${weatherCount}`
    );

    if (weatherCount === 0) {
      throw new Error(
        "No stored NuaSense observations are available."
      );
    }

    const latestWeather = await WeatherObservation.findOne({
      where: {
        weatherStationId: weatherStation.id,
      },
      order: [["recordedAt", "DESC"]],
    });

    console.log("Latest stored weather:");

    console.dir(latestWeather.toJSON(), {
      depth: null,
    });

    // --------------------------------------------------
    // 3. Create temporary farmer
    // --------------------------------------------------
    farmer = await Farmer.create({
      name: "AgriMama Real Weather Context Farmer",
      phone: `254703${Date.now().toString().slice(-6)}`,
      preferredLanguage: "en",
      consentStatus: true,
      consentAt: new Date(),
    });

    console.log(
      "Farmer created:",
      farmer.id
    );

    // --------------------------------------------------
    // 4. Create farm
    // --------------------------------------------------
    farm = await Farm.create({
      farmerId: farmer.id,
      name: "AgriMama Real Weather Test Farm",
      sizeAcres: 2,
      latitude: -0.5276,
      longitude: 34.4571,
      locationAccuracyMeters: 10,
    });

    console.log(
      "Farm created:",
      farm.id
    );

    // --------------------------------------------------
    // 5. Link the REAL NuaSense station
    // --------------------------------------------------
    farmWeatherStation =
      await FarmWeatherStation.create({
        farmId: farm.id,
        weatherStationId: weatherStation.id,
        activeFrom: new Date(),
        active: true,
      });

    console.log(
      "Real NuaSense station linked to test farm."
    );

    // --------------------------------------------------
    // 6. Create maize crop
    // --------------------------------------------------
    cropCycle = await CropCycle.create({
      farmId: farm.id,
      crop: "maize",
      variety: "test-variety",
      plantingDate: new Date(),
      currentStage: "vegetative_growth",
      status: "active",
    });

    console.log(
      "Crop cycle created:",
      cropCycle.id
    );

    // --------------------------------------------------
    // 7. Create farmer dryness observation
    //
    // No AI/API call here.
    // We're testing the decision layer using an
    // already-stored farmer observation.
    // --------------------------------------------------
    farmerObservation =
      await FarmerObservation.create({
        farmerId: farmer.id,
        farmId: farm.id,
        cropCycleId: cropCycle.id,
        category: "weather",
        observation:
          "The rain has stopped and my young maize is starting to dry.",
        observedAt: new Date(),
        source: "farmer",
        language: "en",
      });

    console.log(
      "Farmer observation created:",
      farmerObservation.id
    );

    // --------------------------------------------------
    // 8. Build decision context
    //
    // IMPORTANT:
    // This does NOT call NuaSense.
    //
    // It reads the existing weather observations
    // from PostgreSQL.
    // --------------------------------------------------
    console.log(
      "Building AgriMama decision context..."
    );

    const context =
      await buildDecisionContext(
        cropCycle.id
      );

    console.log(
      "DECISION CONTEXT:"
    );

    console.dir(
      {
        farmer: context.farmer,
        farm: context.farm,
        cropCycle: context.cropCycle,
        observations: context.observations,
        weatherStations: context.weatherStations,
        weatherObservationCount:
          context.weather.length,
        latestWeather:
          context.weather[0] || null,
      },
      { depth: null }
    );

    // --------------------------------------------------
    // 9. Verify weather context
    // --------------------------------------------------
    if (
      !context.weatherStations ||
      context.weatherStations.length === 0
    ) {
      throw new Error(
        "Decision context did not contain the linked weather station."
      );
    }

    if (!context.weather.length) {
      throw new Error(
        "Decision context did not contain stored weather observations."
      );
    }

    console.log(
      "Stored NuaSense weather successfully entered decision context."
    );

    // --------------------------------------------------
    // 10. Run rules
    // --------------------------------------------------
    const matchedRules =
      evaluateRules(context);

    console.log(
      "MATCHED RULES:"
    );

    console.dir(
      matchedRules,
      { depth: null }
    );

    const decision =
      selectPrimaryDecision(
        matchedRules
      );

    if (!decision) {
      throw new Error(
        "No decision was generated."
      );
    }

    console.log(
      "PRIMARY DECISION:"
    );

    console.dir(
      decision,
      { depth: null }
    );

    // --------------------------------------------------
    // 11. Verify weather rule
    // --------------------------------------------------
    if (
      decision.source !==
      "AgriMama weather dryness rule"
    ) {
      throw new Error(
        `Expected weather dryness rule but received ${decision.source}`
      );
    }

    if (
      decision.observationId !==
      farmerObservation.id
    ) {
      throw new Error(
        "Decision is not linked to the farmer observation."
      );
    }

    if (
      decision.requiresHumanReview !== true
    ) {
      throw new Error(
        "Decision should require human review."
      );
    }

    console.log(
      "Weather observation + farmer observation + decision rule verified."
    );

    console.log(
      "REAL STORED NuaSense WEATHER CONTEXT TEST PASSED!"
    );

  } catch (error) {
    console.error(
      "REAL WEATHER CONTEXT TEST FAILED."
    );

    console.error(error);

    process.exitCode = 1;
  } finally {
    // --------------------------------------------------
    // Cleanup only our temporary records.
    //
    // IMPORTANT:
    // The real NuaSense WeatherStation and its
    // WeatherObservation records are NOT deleted.
    // --------------------------------------------------
    console.log(
      "Cleaning up temporary test data..."
    );

    if (recommendation) {
      await Recommendation.destroy({
        where: {
          id: recommendation.id,
        },
      });
    }

    if (farmerObservation) {
      await FarmerObservation.destroy({
        where: {
          id: farmerObservation.id,
        },
      });
    }

    if (farmWeatherStation) {
      await FarmWeatherStation.destroy({
        where: {
          id: farmWeatherStation.id,
        },
      });
    }

    if (cropCycle) {
      await CropCycle.destroy({
        where: {
          id: cropCycle.id,
        },
      });
    }

    if (farm) {
      await Farm.destroy({
        where: {
          id: farm.id,
        },
      });
    }

    if (farmer) {
      await Farmer.destroy({
        where: {
          id: farmer.id,
        },
      });
    }

    console.log(
      "🧹 Temporary test data cleaned up."
    );
  }
}

run();