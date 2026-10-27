
import sequelize from "../../config/database.js";
import Farmer from "../../models/farmer.js";
import Farm from "../../models/farm.js";
import CropCycle from "../../models/cropCycle.js";
import WeatherStation from "../../models/weatherStation.js";
import FarmWeatherStation from "../../models/farmWeatherStation.js";
import FarmerObservation from "../../models/farmerObservation.js";
import Recommendation from "../../models/recommendation.js";
import { generateRecommendation } from "../../services/decisionEngine.js";

async function runTest() {
  let farmer;
  let farm;
  let cropCycle;
  let oldCropHealthObservation;
  let observation;
  let recommendation;
  let farmWeatherStation;

  try {
    console.log(
      "🔄 Testing current weather observation against older crop-health history...\n"
    );

    // 1. Create test farmer.
    farmer = await Farmer.create({
      name: "Weather Conflict Test Farmer",
      phone: `+254700${Date.now().toString().slice(-6)}`,
      preferredLanguage: "en",
      consentStatus: true,
      consentAt: new Date(),
    });

    console.log(`👩 Farmer: ${farmer.id}`);

    // 2. Create test farm.
    farm = await Farm.create({
      farmerId: farmer.id,
      name: "Weather Conflict Test Farm",
      sizeAcres: 2,
      latitude: -0.55,
      longitude: 34.75,
    });

    console.log(`🌱 Farm: ${farm.id}`);

    // 3. Create maize crop cycle.
    cropCycle = await CropCycle.create({
      farmId: farm.id,
      crop: "maize",
      variety: "test variety",
      plantingDate: new Date(),
      currentStage: "vegetative_growth",
      status: "active",
    });

    console.log(`🌽 Crop cycle: ${cropCycle.id}`);

    // 4. Find existing NuaSense weather station.
    console.log("\n🌦️ Finding NuaSense weather station...");

    const weatherStation = await WeatherStation.findOne({
      where: {
        provider: "nuasense",
        gatewayId: "704bcafffe69cbc0",
      },
    });

    if (!weatherStation) {
      throw new Error("NuaSense weather station was not found.");
    }

    console.log(`🌦️ Weather station: ${weatherStation.id}`);

    // 5. Link farm to weather station.
    farmWeatherStation = await FarmWeatherStation.create({
      farmId: farm.id,
      weatherStationId: weatherStation.id,
      activeFrom: new Date(),
      active: true,
    });

    console.log(
      `🔗 Farm-weather relationship: ${farmWeatherStation.id}`
    );

    // 6. Create an older crop-health observation.
    oldCropHealthObservation = await FarmerObservation.create({
      farmerId: farmer.id,
      farmId: farm.id,
      cropCycleId: cropCycle.id,
      category: "crop_health",
      observation:
        "My maize leaves are being eaten by insects.",
      observedAt: new Date(Date.now() - 60_000),
      source: "farmer",
      language: "en",
    });

    console.log(
      `🐛 Older crop-health observation: ${oldCropHealthObservation.id}`
    );

    // 7. Create the current weather observation.
    observation = await FarmerObservation.create({
      farmerId: farmer.id,
      farmId: farm.id,
      cropCycleId: cropCycle.id,
      category: "weather",
      observation:
        "The rain has stopped and the soil is becoming dry.",
      observedAt: new Date(),
      source: "farmer",
      language: "en",
    });

    console.log(`📝 Current weather observation: ${observation.id}`);

    // 8. Generate a recommendation for the CURRENT observation.
    console.log(
      "\n🧠 Generating recommendation for the current weather observation...\n"
    );

    recommendation = await generateRecommendation(
      cropCycle.id,
      observation.id
    );

    console.log("💡 GENERATED RECOMMENDATION:");
    console.log(JSON.stringify(recommendation.toJSON(), null, 2));

    // 9. Assert that the recommendation uses the current observation.
    if (recommendation.farmerId !== farmer.id) {
      throw new Error("Recommendation farmer ID is incorrect.");
    }

    if (recommendation.farmId !== farm.id) {
      throw new Error("Recommendation farm ID is incorrect.");
    }

    if (recommendation.cropCycleId !== cropCycle.id) {
      throw new Error("Recommendation crop cycle ID is incorrect.");
    }

    if (recommendation.observationId !== observation.id) {
      throw new Error(
        "Recommendation is not linked to the current weather observation."
      );
    }

    if (recommendation.actionCode !== "CHECK_SOIL_MOISTURE") {
      throw new Error(
        `Expected actionCode "CHECK_SOIL_MOISTURE", got "${recommendation.actionCode}".`
      );
    }

    if (recommendation.source !== "AgriMama weather dryness rule") {
      throw new Error(
        `Expected weather dryness rule, got "${recommendation.source}".`
      );
    }

    if (recommendation.status !== "pending") {
      throw new Error(
        `Expected status "pending", got "${recommendation.status}".`
      );
    }

    if (recommendation.requiresHumanReview !== true) {
      throw new Error("Expected recommendation to require human review.");
    }

    if (
      !recommendation.recommendation
        .toLowerCase()
        .includes("soil moisture")
    ) {
      throw new Error(
        "Recommendation does not contain the expected soil-moisture guidance."
      );
    }

    if (
      !recommendation.reason
        .toLowerCase()
        .includes("dry conditions")
    ) {
      throw new Error(
        "Recommendation reason does not mention dry conditions."
      );
    }

    if (
      !recommendation.reason
        .toLowerCase()
        .includes("recent weather information")
    ) {
      throw new Error(
        "Recommendation reason does not contain recent weather information."
      );
    }

    console.log(
      "\n✅ Current weather observation correctly selected."
    );

    console.log(
      "✅ Older crop-health observation did not override the current message."
    );

    console.log(
      "✅ Soil-moisture action code and observation linkage verified."
    );

    console.log(
      "\n🎉 Weather conflict decision-engine test passed!"
    );
  } catch (error) {
    console.error(
      "\n❌ Weather conflict decision-engine test failed."
    );
    console.error(error);
    process.exitCode = 1;
  } finally {
    // Clean up test data.
    console.log("\n🧹 Cleaning up test data...");

    try {
      if (recommendation) {
        await recommendation.destroy();
        console.log("🧹 Test recommendation removed.");
      }

      if (observation) {
        await observation.destroy();
        console.log("🧹 Current weather observation removed.");
      }

      if (oldCropHealthObservation) {
        await oldCropHealthObservation.destroy();
        console.log("🧹 Older crop-health observation removed.");
      }

      if (farmWeatherStation) {
        await farmWeatherStation.destroy();
        console.log("🧹 Test farm-weather relationship removed.");
      }

      if (cropCycle) {
        await cropCycle.destroy();
        console.log("🧹 Test crop cycle removed.");
      }

      if (farm) {
        await farm.destroy();
        console.log("🧹 Test farm removed.");
      }

      if (farmer) {
        await farmer.destroy();
        console.log("🧹 Test farmer removed.");
      }
    } catch (cleanupError) {
      console.error("❌ Test cleanup failed:", cleanupError);
      process.exitCode = 1;
    }

    await sequelize.close();
  }
}

runTest();
