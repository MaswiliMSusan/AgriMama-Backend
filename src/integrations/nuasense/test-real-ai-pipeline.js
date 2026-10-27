import "dotenv/config";

import Farmer from "../../models/farmer.js";
import Farm from "../../models/farm.js";
import CropCycle from "../../models/cropCycle.js";
import FarmerObservation from "../../models/farmerObservation.js";
import Recommendation from "../../models/recommendation.js";

import { interpretFarmerMessage } from "../../services/ai/interpreter.js";
import { generateRecommendation } from "../../services/decisionEngine.js";

async function run() {
  console.log("Testing AgriMama REAL AI → Decision Engine pipeline...\n");

  let farmer;
  let farm;
  let cropCycle;
  let observation;
  let recommendation;

  try {
    // --------------------------------------------------
    // 1. Create test farmer
    // --------------------------------------------------
    farmer = await Farmer.create({
      name: "AgriMama AI Test Farmer",
      phone: `254700${Date.now().toString().slice(-6)}`,
      preferredLanguage: "en",
      consentStatus: true,
      consentAt: new Date(),
    });

    console.log("Farmer created:", farmer.id);

    // --------------------------------------------------
    // 2. Create test farm
    // --------------------------------------------------
    farm = await Farm.create({
      farmerId: farmer.id,
      name: "AgriMama Test Farm",
      sizeAcres: 2,
      latitude: -0.5276,
      longitude: 34.4571,
      locationAccuracyMeters: 10,
    });

    console.log("Farm created:", farm.id);

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

    console.log("Crop cycle created:", cropCycle.id);

    // --------------------------------------------------
    // 4. Farmer sends natural-language message
    // --------------------------------------------------
    const farmerMessage =
      "My maize leaves are being eaten by insects.";

    console.log("Farmer message:");
    console.log(`"${farmerMessage}"`);

    // --------------------------------------------------
    // 5. REAL AI interprets the message
    // --------------------------------------------------
    const interpretation = await interpretFarmerMessage(
      farmerMessage,
      {
        crop: cropCycle.crop,
        growthStage: cropCycle.currentStage,
        language: farmer.preferredLanguage,
      }
    );

    console.log("REAL AI INTERPRETATION:");
    console.dir(interpretation, { depth: null });

    // --------------------------------------------------
    // 6. Validate AI result
    // --------------------------------------------------
    if (interpretation.category !== "crop_health") {
      throw new Error(
        `Expected crop_health, received ${interpretation.category}`
      );
    }

    if (
      typeof interpretation.confidence !== "number" ||
      interpretation.confidence < 0 ||
      interpretation.confidence > 1
    ) {
      throw new Error("Invalid AI confidence value.");
    }

    if (!Array.isArray(interpretation.symptoms)) {
      throw new Error("AI symptoms must be an array.");
    }

    // --------------------------------------------------
    // 7. Store the farmer observation
    // --------------------------------------------------
    observation = await FarmerObservation.create({
      farmerId: farmer.id,
      farmId: farm.id,
      cropCycleId: cropCycle.id,
      category: interpretation.category,
      observation: farmerMessage,
      observedAt: new Date(),
      source: "ai_interpreted",
      language: farmer.preferredLanguage,
    });

    console.log("Farmer observation created:");
    console.log(observation.id);

    // --------------------------------------------------
    // 8. Run the AgriMama decision engine
    // --------------------------------------------------
    recommendation = await generateRecommendation(
      cropCycle.id
    );

    console.log("AGRIMAMA RECOMMENDATION:");
    console.dir(recommendation.toJSON(), { depth: null });

    // --------------------------------------------------
    // 9. Validate recommendation
    // --------------------------------------------------
    if (!recommendation) {
      throw new Error("No recommendation was created.");
    }

    if (recommendation.observationId !== observation.id) {
      throw new Error(
        `Recommendation observationId ${recommendation.observationId} does not match observation ${observation.id}`
      );
    }

    if (!recommendation.recommendation) {
      throw new Error("Recommendation text is missing.");
    }

    if (recommendation.requiresHumanReview !== true) {
      throw new Error(
        "Recommendation should require human review."
      );
    }

    console.log(
      "Observation → Recommendation link verified."
    );

    console.log(
      "REAL AI END-TO-END PIPELINE TEST PASSED!"
    );

  } catch (error) {
    console.error("REAL AI PIPELINE TEST FAILED.");
    console.error(error);
    process.exitCode = 1;

  } finally {
    // --------------------------------------------------
    // Cleanup test records
    // --------------------------------------------------
    console.log("Cleaning up test data...");

    if (recommendation) {
      await Recommendation.destroy({
        where: { id: recommendation.id },
      });
    }

    if (observation) {
      await FarmerObservation.destroy({
        where: { id: observation.id },
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