import { evaluateCropHealth } from "../../services/decisionRules/cropHealth.js";

function testCropHealthObservation() {
  const context = {
    farmer: {
      id: "farmer-1",
      preferredLanguage: "dholuo",
    },

    farm: {
      id: "farm-1",
    },

    cropCycle: {
      id: "crop-cycle-1",
      crop: "sweet_potato",
      currentStage: "vegetative_growth",
    },

    observations: [
      {
        id: "observation-1",
        category: "crop_health",
        observation:
          "My sweet potato leaves are being eaten by insects.",
        language: "dholuo",
      },
    ],

    weather: [
      {
        temperature: 16.57,
        humidity: 63.6,
        rainfall: 0,
      },
    ],

    weatherStations: [
      {
        id: "station-1",
        provider: "nuasense",
      },
    ],
  };

  const decision = evaluateCropHealth(context);

  if (!decision) {
    throw new Error("Expected crop health rule to return a decision.");
  }

  if (decision.type !== "inspection") {
    throw new Error(
      `Expected decision type to be "inspection", got "${decision.type}".`
    );
  }

  if (decision.requiresHumanReview !== true) {
    throw new Error("Expected recommendation to require human review.");
  }

  console.log("✓ Crop health observation test passed.");
  console.log("Decision:");
  console.log(decision);
}

function testWeatherObservationIsIgnored() {
  const context = {
    farmer: {
      id: "farmer-1",
      preferredLanguage: "dholuo",
    },

    farm: {
      id: "farm-1",
    },

    cropCycle: {
      id: "crop-cycle-1",
      crop: "maize",
      currentStage: "vegetative_growth",
    },

    observations: [
      {
        id: "observation-2",
        category: "weather",
        observation:
          "The rain has stopped and the soil is becoming dry.",
        language: "dholuo",
      },
    ],

    weather: [],
    weatherStations: [],
  };

  const decision = evaluateCropHealth(context);

  if (decision !== null) {
    throw new Error(
      "Expected crop health rule to ignore a non-crop-health observation."
    );
  }

  console.log("✓ Non-crop-health observation test passed.");
}

try {
  console.log("\nRunning crop health rule tests...\n");

  testCropHealthObservation();
  testWeatherObservationIsIgnored();

  console.log("All crop health rule tests passed.\n");
} catch (error) {
  console.error("Crop health rule test failed.");
  console.error(error);
  process.exit(1);
}