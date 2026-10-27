
import sequelize from "../../config/database.js";
import Farmer from "../../models/farmer.js";
import Farm from "../../models/farm.js";
import CropCycle from "../../models/cropCycle.js";
import FarmerObservation from "../../models/farmerObservation.js";
import Recommendation from "../../models/recommendation.js";
import { generateRecommendation } from "../../services/decisionEngine.js";

async function testDecisionEngineFallback() {
  let farmer;
  let farm;
  let cropCycle;
  let oldCropHealthObservation;
  let currentGeneralObservation;
  let recommendation;

  try {
    console.log(
      "🔄 Testing fallback for a current observation that matches no decision rule...\n"
    );

    await sequelize.authenticate();

    // 1. Create temporary farmer, farm, and crop cycle.
    farmer = await Farmer.create({
      name: "AgriMama Fallback Test",
      phone: `+2547${Date.now().toString().slice(-8)}`,
      preferredLanguage: "en",
    });

    farm = await Farm.create({
      farmerId: farmer.id,
      name: "Fallback Test Farm",
    });

    cropCycle = await CropCycle.create({
      farmId: farm.id,
      crop: "maize",
      plantingDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      currentStage: "vegetative_growth",
      status: "active",
    });

    console.log(`👩 Farmer: ${farmer.id}`);
    console.log(`🌱 Farm: ${farm.id}`);
    console.log(`🌽 Crop cycle: ${cropCycle.id}\n`);

    // 2. Add an older crop-health observation that could match a rule.
    oldCropHealthObservation = await FarmerObservation.create({
      farmerId: farmer.id,
      farmId: farm.id,
      cropCycleId: cropCycle.id,
      category: "crop_health",
      observation:
        "Insects are eating the maize leaves, and several leaves have damage.",
      observedAt: new Date(Date.now() - 60 * 1000),
      source: "test",
      language: "en",
    });

    console.log(
      `🐛 Older crop-health observation: ${oldCropHealthObservation.id}`
    );

    // 3. Add a current general observation.
    currentGeneralObservation = await FarmerObservation.create({
      farmerId: farmer.id,
      farmId: farm.id,
      cropCycleId: cropCycle.id,
      category: "general",
      observation: "I would like general guidance about my farm.",
      observedAt: new Date(),
      source: "test",
      language: "en",
    });

    console.log(
      `📝 Current general observation: ${currentGeneralObservation.id}\n`
    );

    // 4. Generate the decision using the current observation ID.
    console.log("🧠 Generating recommendation for the current general observation...\n");

    recommendation = await generateRecommendation(
      cropCycle.id,
      currentGeneralObservation.id
    );

    console.log("💡 GENERATED RECOMMENDATION:");
    console.log(JSON.stringify(recommendation.toJSON(), null, 2));
    console.log("");

    // 5. Verify that the safe fallback is selected.
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
        "Current general observation is linked",
        recommendation.observationId === currentGeneralObservation.id,
      ],
      [
        "Fallback action code is selected",
        recommendation.actionCode === "PROVIDE_MORE_INFORMATION",
      ],
      [
        "Recommendation remains pending",
        recommendation.status === "pending",
      ],
      [
        "Human review is required",
        recommendation.requiresHumanReview === true,
      ],
      [
        "Older crop-health action was not selected",
        recommendation.actionCode !== "INSPECT_CROP_DAMAGE",
      ],
      [
        "Weather-dryness action was not selected",
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
        "Decision-engine fallback test failed. Review the checks above."
      );
    }

    console.log("\n🎉 Decision-engine fallback test passed!");
  } catch (error) {
    console.error("\n❌ Decision-engine fallback test failed:");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    console.log("\n🧹 Cleaning up test data...");

    try {
      if (recommendation) {
        await Recommendation.destroy({
          where: { id: recommendation.id },
        });
        console.log("🧹 Test recommendation removed.");
      }

      if (currentGeneralObservation) {
        await FarmerObservation.destroy({
          where: { id: currentGeneralObservation.id },
        });
        console.log("🧹 Current general observation removed.");
      }

      if (oldCropHealthObservation) {
        await FarmerObservation.destroy({
          where: { id: oldCropHealthObservation.id },
        });
        console.log("🧹 Older crop-health observation removed.");
      }

      if (cropCycle) {
        await CropCycle.destroy({
          where: { id: cropCycle.id },
        });
        console.log("🧹 Test crop cycle removed.");
      }

      if (farm) {
        await Farm.destroy({
          where: { id: farm.id },
        });
        console.log("🧹 Test farm removed.");
      }

      if (farmer) {
        await Farmer.destroy({
          where: { id: farmer.id },
        });
        console.log("🧹 Test farmer removed.");
      }
    } catch (cleanupError) {
      console.error("⚠️ Test cleanup encountered an error:");
      console.error(cleanupError.message);
      process.exitCode = 1;
    }

    await sequelize.close();
  }
}

testDecisionEngineFallback();
