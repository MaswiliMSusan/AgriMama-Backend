import sequelize from "../../config/database.js";
import Farmer from "../../models/farmer.js";
import Farm from "../../models/farm.js";
import CropCycle from "../../models/cropCycle.js";
import WeatherStation from "../../models/weatherStation.js";
import FarmWeatherStation from "../../models/farmWeatherStation.js";
import FarmerObservation from "../../models/farmerObservation.js";
import Recommendation from "../../models/recommendation.js";
import { generateRecommendation } from "../../services/decisionEngine.js";

async function testCropHealthConflictDecisionEngine() {
  let farmer;
  let farm;
  let cropCycle;
  let farmWeatherStation;
  let oldWeatherObservation;
  let currentCropHealthObservation;
  let recommendation;

  try {
    console.log(
      "Testing current crop-health observation against older weather history...\n"
    );

    await sequelize.authenticate();

    // 1. Create temporary farmer, farm, and crop cycle.
    farmer = await Farmer.create({
      name: "AgriMama Crop Health Conflict Test",
      phone: `+2547${Date.now().toString().slice(-8)}`,
      preferredLanguage: "en",
    });

    farm = await Farm.create({
      farmerId: farmer.id,
      name: "Crop Health Conflict Test Farm",
      location: "Mikai, Homa Bay",
    });

    cropCycle = await CropCycle.create({
      farmerId: farmer.id,
      farmId: farm.id,
      crop: "maize",
      growthStage: "vegetative_growth",
      status: "active",
      plantingDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    });

    console.log(`Farmer: ${farmer.id}`);
    console.log(`Farm: ${farm.id}`);
    console.log(`Crop cycle: ${cropCycle.id}\n`);

    // 2. Find the existing NuaSense weather station.
    console.log("Finding NuaSense weather station...");

    const weatherStation = await WeatherStation.findOne({
      where: {
        provider: "nuasense",
      },
    });

    if (!weatherStation) {
      throw new Error(
        "No NuaSense weather station found. Check the WeatherStation provider field and existing station record."
      );
    }

    console.log(`Weather station: ${weatherStation.id}`);

    // 3. Link the test farm to the weather station.
    farmWeatherStation = await FarmWeatherStation.create({
      farmId: farm.id,
      weatherStationId: weatherStation.id,
      activeFrom: new Date(),
      active: true,
    });

    console.log(`Farm-weather relationship: ${farmWeatherStation.id}`);

    // 4. Create an older weather observation.
    oldWeatherObservation = await FarmerObservation.create({
      farmerId: farmer.id,
      farmId: farm.id,
      cropCycleId: cropCycle.id,
      category: "weather",
      observation:
        "The weather has been dry, and there has been little rainfall.",
      observedAt: new Date(Date.now() - 60 * 1000),
      source: "test",
      language: "en",
    });

    console.log(`Older weather observation: ${oldWeatherObservation.id}`);

    // 5. Create the current crop-health observation.
    currentCropHealthObservation = await FarmerObservation.create({
      farmerId: farmer.id,
      farmId: farm.id,
      cropCycleId: cropCycle.id,
      category: "crop_health",
      observation:
        "Insects are eating the maize leaves. Several leaves have visible damage.",
      observedAt: new Date(),
      source: "test",
      language: "en",
    });

    console.log(
      `🐛 Current crop-health observation: ${currentCropHealthObservation.id}\n`
    );

    // 6. Generate the decision using the CURRENT observation ID.
    console.log("Generating recommendation for the current crop-health report...\n");

    recommendation = await generateRecommendation(
      cropCycle.id,
      currentCropHealthObservation.id
    );

    console.log("GENERATED RECOMMENDATION:");
    console.log(JSON.stringify(recommendation.toJSON(), null, 2));
    console.log("");

    // 7. Verify the current crop-health report takes priority.
    const checks = [
      [
        "Recommendation belongs to the test farmer",
        recommendation.farmerId === farmer.id,
      ],
      [
        "Recommendation belongs to the test farm",
        recommendation.farmId === farm.id,
      ],
      [
        "Recommendation belongs to the test crop cycle",
        recommendation.cropCycleId === cropCycle.id,
      ],
      [
        "Current crop-health observation is linked",
        recommendation.observationId === currentCropHealthObservation.id,
      ],
      [
        "Crop-health action code is selected",
        recommendation.actionCode === "INSPECT_CROP_DAMAGE",
      ],
      [
        "Recommendation is pending",
        recommendation.status === "pending",
      ],
      [
        "Human review is required",
        recommendation.requiresHumanReview === true,
      ],
      [
        "Recommendation advises inspecting crop damage",
        /inspect/i.test(recommendation.recommendation),
      ],
      [
        "Recommendation does not select the weather dryness action",
        recommendation.actionCode !== "CHECK_SOIL_MOISTURE",
      ],
    ];

    let failed = false;

    for (const [description, passed] of checks) {
      console.log(`${passed ? "✅" : "❌"} ${description}`);
      if (!passed) failed = true;
    }

    if (failed) {
      throw new Error(
        "Crop-health conflict decision-engine test failed. Review the checks above."
      );
    }

    console.log(
      "\n🎉 Crop-health conflict decision-engine test passed!"
    );
  } catch (error) {
    console.error("Crop-health conflict decision-engine test failed:");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    // 8. Clean up only the records created by this test.
    console.log("Cleaning up test data...");

    try {
      if (recommendation) {
        await Recommendation.destroy({
          where: { id: recommendation.id },
        });
        console.log("Test recommendation removed.");
      }

      if (currentCropHealthObservation) {
        await FarmerObservation.destroy({
          where: { id: currentCropHealthObservation.id },
        });
        console.log("Current crop-health observation removed.");
      }

      if (oldWeatherObservation) {
        await FarmerObservation.destroy({
          where: { id: oldWeatherObservation.id },
        });
        console.log("Older weather observation removed.");
      }

      if (farmWeatherStation) {
        await FarmWeatherStation.destroy({
          where: { id: farmWeatherStation.id },
        });
        console.log("Test farm-weather relationship removed.");
      }

      if (cropCycle) {
        await CropCycle.destroy({
          where: { id: cropCycle.id },
        });
        console.log("Test crop cycle removed.");
      }

      if (farm) {
        await Farm.destroy({
          where: { id: farm.id },
        });
        console.log("Test farm removed.");
      }

      if (farmer) {
        await Farmer.destroy({
          where: { id: farmer.id },
        });
        console.log(" Test farmer removed.");
      }
    } catch (cleanupError) {
      console.error("Test cleanup encountered an error:");
      console.error(cleanupError.message);
      process.exitCode = 1;
    }

    await sequelize.close();
  }
}

testCropHealthConflictDecisionEngine();
