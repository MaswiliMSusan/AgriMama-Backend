import "dotenv/config";

import Farmer from "../../models/farmer.js";
import Farm from "../../models/farm.js";
import CropCycle from "../../models/cropCycle.js";
import FarmerObservation from "../../models/farmerObservation.js";
import Recommendation from "../../models/recommendation.js";

async function run() {
  console.log("🌱 Testing AgriMama POST /api/observations...\n");

  let farmer;
  let farm;
  let cropCycle;

  try {
    // --------------------------------------------------
    // 1. Create temporary farmer
    // --------------------------------------------------
    farmer = await Farmer.create({
      name: "AgriMama API Test Farmer",
      phone: `254701${Date.now().toString().slice(-6)}`,
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
      name: "AgriMama API Test Farm",
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
    // 4. Farmer message
    // --------------------------------------------------
    const farmerMessage =
      "My maize leaves are being eaten by insects.";

    console.log("\n💬 Farmer message:");
    console.log(`"${farmerMessage}"`);

    // --------------------------------------------------
    // 5. Call the REAL API endpoint
    // --------------------------------------------------
    console.log("\n📡 Sending request to POST /api/observations...");

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
    // 6. Validate HTTP response
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
    // 7. Validate AI interpretation
    // --------------------------------------------------
    if (!result.interpretation) {
      throw new Error(
        "API response is missing AI interpretation."
      );
    }

    if (result.interpretation.category !== "crop_health") {
      throw new Error(
        `Expected crop_health but received ${result.interpretation.category}`
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
      "\n🧠 Real AI interpretation verified."
    );

    // --------------------------------------------------
    // 8. Validate saved observation
    // --------------------------------------------------
    if (!result.observation) {
      throw new Error(
        "API response is missing observation."
      );
    }

    if (result.observation.source !== "ai_interpreted") {
      throw new Error(
        `Expected source ai_interpreted but received ${result.observation.source}`
      );
    }

    if (
      result.observation.category !==
      result.interpretation.category
    ) {
      throw new Error(
        "Observation category does not match AI interpretation."
      );
    }

    console.log(
      "📝 Farmer observation verified."
    );

    // --------------------------------------------------
    // 9. Validate recommendation
    // --------------------------------------------------
    if (!result.recommendation) {
      throw new Error(
        "API response is missing recommendation."
      );
    }

    if (
      result.recommendation.observationId !==
      result.observation.id
    ) {
      throw new Error(
        "Recommendation is not linked to the created observation."
      );
    }

    if (
      result.recommendation.requiresHumanReview !== true
    ) {
      throw new Error(
        "Recommendation should require human review."
      );
    }

    if (!result.recommendation.recommendation) {
      throw new Error(
        "Recommendation text is missing."
      );
    }

    console.log(
      "🌱 Recommendation verified."
    );

    // --------------------------------------------------
    // 10. Print final result
    // --------------------------------------------------
    console.log("\n🔗 PIPELINE VERIFIED:");

    console.log(
      `Farmer message → ${result.interpretation.category}`
    );

    console.log(
      `Observation → ${result.observation.id}`
    );

    console.log(
      `Recommendation → ${result.recommendation.id}`
    );

    console.log(
      `Human review → ${result.recommendation.requiresHumanReview}`
    );

    console.log(
      "\n✅ POST /api/observations END-TO-END TEST PASSED!"
    );

  } catch (error) {
    console.error(
      "\n❌ API PIPELINE TEST FAILED."
    );

    console.error(error);

    process.exitCode = 1;

  } finally {
    // --------------------------------------------------
    // Cleanup
    // --------------------------------------------------
    console.log("\n🧹 Cleaning up test data...");

    if (farmer) {
      // Recommendations and observations cascade
      // from farmer through their foreign keys.
      await Recommendation.destroy({
        where: { farmerId: farmer.id },
      });

      await FarmerObservation.destroy({
        where: { farmerId: farmer.id },
      });
    }

    if (cropCycle) {
      await CropCycle.destroy({
        where: { id: cropCycle.id },
      });
    }

    if (farm) {
      await Farm.destroy({
        where: { id: farm.id },
      });
    }

    if (farmer) {
      await Farmer.destroy({
        where: { id: farmer.id },
      });
    }

    console.log("🧹 Test data cleaned up.");
  }
}

run();