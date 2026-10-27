import "dotenv/config";

import Farmer from "../../models/farmer.js";
import Farm from "../../models/farm.js";
import CropCycle from "../../models/cropCycle.js";
import WeatherStation from "../../models/weatherStation.js";
import FarmWeatherStation from "../../models/farmWeatherStation.js";
import WeatherObservation from "../../models/weatherObservation.js";
import FarmerObservation from "../../models/farmerObservation.js";
import Recommendation from "../../models/recommendation.js";

async function run() {
  console.log(
    "🌦️ Testing REAL AI + NuaSense weather + Decision Engine...\n"
  );

  let farmer;
  let farm;
  let cropCycle;
  let weatherStation;
  let farmWeatherStation;
  let weatherObservation;

  try {
    // --------------------------------------------------
    // 1. Create temporary farmer
    // --------------------------------------------------
    farmer = await Farmer.create({
      name: "AgriMama Weather Test Farmer",
      phone: `254702${Date.now().toString().slice(-6)}`,
      preferredLanguage: "en",
      consentStatus: true,
      consentAt: new Date(),
    });

    console.log("👩 Farmer created:", farmer.id);

    // --------------------------------------------------
    // 2. Create temporary farm
    // --------------------------------------------------
    farm = await Farm.create({
      farmerId: farmer.id,
      name: "AgriMama Weather Test Farm",
      sizeAcres: 2,
      latitude: -0.5276,
      longitude: 34.4571,
      locationAccuracyMeters: 10,
    });

    console.log("🌾 Farm created:", farm.id);

    // --------------------------------------------------
    // 3. Create maize crop cycle
    // --------------------------------------------------
    cropCycle = await CropCycle.create({
      farmId: farm.id,
      crop: "maize",
      variety: "test-variety",
      plantingDate: new Date(),
      currentStage: "vegetative_growth",
      status: "active",
    });

    console.log("🌽 Crop cycle created:", cropCycle.id);

    // --------------------------------------------------
    // 4. Create temporary weather station
    // --------------------------------------------------
    weatherStation = await WeatherStation.create({
      provider: "nuasense",
      gatewayId: `test-weather-${Date.now()}`,
      latitude: -0.5276,
      longitude: 34.4571,
      active: true,
    });

    console.log(
      "🌦️ Weather station created:",
      weatherStation.id
    );

    // --------------------------------------------------
    // 5. Link weather station to farm
    // --------------------------------------------------
    farmWeatherStation = await FarmWeatherStation.create({
      farmId: farm.id,
      weatherStationId: weatherStation.id,
      activeFrom: new Date(),
      active: true,
    });

    console.log(
      "🔗 Weather station linked to farm."
    );

    // --------------------------------------------------
    // 6. Create recent weather observation
    //
    // These values are intentionally realistic test
    // values, but the important thing is that weather
    // context is actually available to the decision engine.
    // --------------------------------------------------
    weatherObservation = await WeatherObservation.create({
      weatherStationId: weatherStation.id,
      recordedAt: new Date(),
      temperature: 29,
      humidity: 48,
      pressure: 1008,
      rainfall: 0,
      windSpeed: 2,
      windGusts: 4,
      windDirection: 180,
      latitude: -0.5276,
      longitude: 34.4571,
      batteryPercent: 92,
    });

    console.log(
      "📡 Weather observation created:",
      weatherObservation.id
    );

    // --------------------------------------------------
    // 7. Farmer message
    // --------------------------------------------------
    const farmerMessage =
      "The rain has stopped and my young maize is starting to dry.";

    console.log("\n💬 Farmer message:");
    console.log(`"${farmerMessage}"`);

    // --------------------------------------------------
    // 8. Call actual API
    // --------------------------------------------------
    console.log(
      "\n📡 Sending request to POST /api/observations..."
    );

    const response = await fetch(
      "http://localhost:7000/api/observations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          farmerId: farmer.id,
          farmId: farm.id,
          cropCycleId: cropCycle.id,
          message: farmerMessage,
          language: "en",
        }),
      }
    );

    const result = await response.json();

    console.log("\n📥 API STATUS:", response.status);

    console.log("\n📋 API RESPONSE:");
    console.dir(result, { depth: null });

    // --------------------------------------------------
    // 9. Validate API response
    // --------------------------------------------------
    if (response.status !== 201) {
      throw new Error(
        `Expected HTTP 201 but received ${response.status}`
      );
    }

    if (!result.success) {
      throw new Error(
        "API response did not contain success: true."
      );
    }

    // --------------------------------------------------
    // 10. Validate real AI interpretation
    // --------------------------------------------------
    if (!result.interpretation) {
      throw new Error(
        "API response is missing AI interpretation."
      );
    }

    console.log(
      "\n🧠 REAL AI INTERPRETATION:"
    );

    console.dir(result.interpretation, {
      depth: null,
    });

    if (result.interpretation.category !== "weather") {
      throw new Error(
        `Expected category weather, received ${result.interpretation.category}`
      );
    }

    if (
      typeof result.interpretation.confidence !== "number" ||
      result.interpretation.confidence < 0 ||
      result.interpretation.confidence > 1
    ) {
      throw new Error(
        "AI confidence is invalid."
      );
    }

    console.log(
      "✅ Real AI correctly classified the message as weather."
    );

    // --------------------------------------------------
    // 11. Validate farmer observation
    // --------------------------------------------------
    if (!result.observation) {
      throw new Error(
        "API response is missing farmer observation."
      );
    }

    if (result.observation.category !== "weather") {
      throw new Error(
        `Expected saved observation category weather, received ${result.observation.category}`
      );
    }

    console.log(
      "📝 Farmer weather observation verified."
    );

    // --------------------------------------------------
    // 12. Validate recommendation
    // --------------------------------------------------
    if (!result.recommendation) {
      throw new Error(
        "API response is missing recommendation."
      );
    }

    console.log(
      "\n🌱 WEATHER RECOMMENDATION:"
    );

    console.dir(result.recommendation, {
      depth: null,
    });

    if (
      result.recommendation.observationId !==
      result.observation.id
    ) {
      throw new Error(
        "Recommendation is not linked to the farmer observation."
      );
    }

    if (
      result.recommendation.source !==
      "AgriMama weather dryness rule"
    ) {
      throw new Error(
        `Expected weather dryness rule but received ${result.recommendation.source}`
      );
    }

    if (
      result.recommendation.requiresHumanReview !== true
    ) {
      throw new Error(
        "Weather recommendation should require human review."
      );
    }

    console.log(
      "\n🔗 Observation → Weather rule → Recommendation verified."
    );

    // --------------------------------------------------
    // 13. Verify NuaSense/weather context directly
    // --------------------------------------------------
    console.log(
      "\n📡 NuaSense weather context:"
    );

    console.log({
      temperature: weatherObservation.temperature,
      humidity: weatherObservation.humidity,
      rainfall: weatherObservation.rainfall,
      windSpeed: weatherObservation.windSpeed,
    });

    console.log(
      "\n🌦️ REAL AI + WEATHER + DECISION PIPELINE PASSED!"
    );

  } catch (error) {
    console.error(
      "\n❌ WEATHER PIPELINE TEST FAILED."
    );

    console.error(error);

    process.exitCode = 1;

  } finally {
    // --------------------------------------------------
    // Cleanup
    // --------------------------------------------------
    console.log(
      "\n🧹 Cleaning up test data..."
    );

    if (farmer) {
      await Recommendation.destroy({
        where: { farmerId: farmer.id },
      });

      await FarmerObservation.destroy({
        where: { farmerId: farmer.id },
      });
    }

    if (weatherObservation) {
      await WeatherObservation.destroy({
        where: {
          id: weatherObservation.id,
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

    if (weatherStation) {
      await WeatherStation.destroy({
        where: {
          id: weatherStation.id,
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
      "🧹 Test data cleaned up."
    );
  }
}

run();