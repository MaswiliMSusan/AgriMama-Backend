
import "dotenv/config";

import Farmer from "../../models/farmer.js";
import Farm from "../../models/farm.js";
import CropCycle from "../../models/cropCycle.js";
import Recommendation from "../../models/recommendation.js";
import FarmerObservation from "../../models/farmerObservation.js";
import sequelize from "../../config/database.js";

async function run() {
  console.log(
    "👩🏾 Testing AgriMama end-to-end farmer-message flow...\n"
  );

  let farmer;
  let farm;
  let cropCycle;
  let testPassed = false;

  try {
    await sequelize.authenticate();

    // --------------------------------------------------
    // 1. Create test farmer
    // --------------------------------------------------
    const phone = `254704${Date.now().toString().slice(-6)}`;

    farmer = await Farmer.create({
      name: "AgriMama Context Test Farmer",
      phone,
      preferredLanguage: "en",
      consentStatus: true,
      consentAt: new Date(),
    });

    console.log("👩 Farmer created:", farmer.id);

    // --------------------------------------------------
    // 2. Create farm
    // --------------------------------------------------
    farm = await Farm.create({
      farmerId: farmer.id,
      name: "My Farm",
      sizeAcres: 2,
      latitude: -0.5276,
      longitude: 34.4571,
      locationAccuracyMeters: 10,
    });

    console.log("🌾 Farm created:", farm.id);

    // --------------------------------------------------
    // 3. Create active maize crop
    // --------------------------------------------------
    cropCycle = await CropCycle.create({
      farmId: farm.id,
      crop: "maize",
      variety: "test-variety",
      plantingDate: new Date(),
      currentStage: "vegetative_growth",
      status: "active",
    });

    console.log("🌽 Active crop created:", cropCycle.id);

    // --------------------------------------------------
    // 4. Farmer sends only the problem
    // --------------------------------------------------
    const message =
      "My maize leaves are being eaten by insects.";

    console.log("\n💬 Farmer sends:");
    console.log(`"${message}"`);

    console.log("\n📡 Calling POST /api/messages...");

    // --------------------------------------------------
    // 5. Call actual API
    // --------------------------------------------------
    const response = await fetch(
      "http://localhost:7000/api/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone,
          message,
          language: "en",
          channel: "sms",
        }),
      }
    );

    const result = await response.json();

    console.log("\n📥 API STATUS:", response.status);
    console.log("\n📋 RESPONSE:");
    console.dir(result, { depth: null });

    // --------------------------------------------------
    // 6. Validate HTTP response and API success
    // --------------------------------------------------
    if (response.status !== 201) {
      throw new Error(
        `Expected HTTP 201 but received ${response.status}`
      );
    }

    if (!result.success) {
      throw new Error("Expected success=true.");
    }

    // --------------------------------------------------
    // 7. Validate farmer context
    // --------------------------------------------------
    if (result.farmer?.id !== farmer.id) {
      throw new Error("API resolved the wrong farmer.");
    }

    if (result.farm?.id !== farm.id) {
      throw new Error("API resolved the wrong farm.");
    }

    if (result.cropCycle?.id !== cropCycle.id) {
      throw new Error("API resolved the wrong crop cycle.");
    }

    // --------------------------------------------------
    // 8. Validate AI interpretation
    // --------------------------------------------------
    if (result.interpretation?.category !== "crop_health") {
      throw new Error(
        `Expected crop_health but received ${
          result.interpretation?.category ?? "no category"
        }`
      );
    }

    // --------------------------------------------------
    // 9. Validate saved observation
    // --------------------------------------------------
    if (!result.observation?.id) {
      throw new Error("API did not return a saved observation ID.");
    }

    if (result.observation.observation !== message) {
      throw new Error(
        "Saved observation does not contain the original farmer message."
      );
    }

    if (result.observation.category !== "crop_health") {
      throw new Error(
        `Expected saved observation category crop_health but received ${
          result.observation.category
        }`
      );
    }

    // --------------------------------------------------
    // 10. Validate generated recommendation
    // --------------------------------------------------
    if (!result.recommendation?.id) {
      throw new Error("API did not return a recommendation ID.");
    }

    if (result.recommendation.observationId !== result.observation.id) {
      throw new Error(
        "Recommendation is not linked to the current farmer observation."
      );
    }

    if (result.recommendation.actionCode !== "INSPECT_CROP_DAMAGE") {
      throw new Error(
        `Expected INSPECT_CROP_DAMAGE but received ${
          result.recommendation.actionCode ?? "no action code"
        }`
      );
    }

    if (result.recommendation.status !== "pending") {
      throw new Error(
        `Expected recommendation status pending but received ${
          result.recommendation.status ?? "no status"
        }`
      );
    }

    if (result.recommendation.requiresHumanReview !== true) {
      throw new Error(
        "Expected recommendation to require human review."
      );
    }

    if (
      typeof result.recommendation.recommendation !== "string" ||
      !/inspect/i.test(result.recommendation.recommendation)
    ) {
      throw new Error(
        "Expected recommendation to advise inspecting crop damage."
      );
    }

    // --------------------------------------------------
    // 11. Report successful checks
    // --------------------------------------------------
    console.log("\n✅ Farmer identity resolved.");
    console.log("✅ Farm resolved automatically.");
    console.log("✅ Active crop resolved automatically.");
    console.log("✅ Farmer did not need to send farm/crop IDs.");
    console.log("✅ AI interpreted the message as crop_health.");
    console.log("✅ Original farmer message was saved.");
    console.log("✅ Recommendation was generated.");
    console.log("✅ Correct crop-health action selected.");
    console.log("✅ Recommendation linked to the current observation.");
    console.log("✅ Recommendation remains pending.");
    console.log("✅ Human review is required.");

    console.log("\n🎉 END-TO-END FARMER MESSAGE TEST PASSED!");

    testPassed = true;
  } catch (error) {
    console.error("\n❌ END-TO-END FARMER MESSAGE TEST FAILED.");
    console.error(error);
    process.exitCode = 1;
  } finally {
    // --------------------------------------------------
    // 12. Clean up test records
    // --------------------------------------------------
    console.log("\n🧹 Cleaning up test data...");

    try {
      if (farmer) {
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
    } catch (cleanupError) {
      console.error("⚠️ Test cleanup failed:", cleanupError);
      process.exitCode = 1;
    }

    try {
      await sequelize.close();
    } catch (closeError) {
      console.error("⚠️ Database connection close failed:", closeError);
      process.exitCode = 1;
    }

    if (!testPassed) {
      console.log("ℹ️ Review the error above before rerunning the test.");
    }
  }
}

run();
