import { evaluateWeatherDryness } from "../../services/decisionRules/weatherDryness.js";

function testDryWeatherObservation() {
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
        id: "observation-1",
        category: "weather",
        observation:
          "The rain has stopped and the soil is becoming dry.",
        language: "dholuo",
      },
    ],

    weather: [
      {
        temperature: 27.4,
        humidity: 51.2,
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

  const decision = evaluateWeatherDryness(context);

  if (!decision) {
    throw new Error("Expected weather dryness rule to return a decision.");
  }

  if (decision.type !== "inspection") {
    throw new Error(
      `Expected decision type to be "inspection", got "${decision.type}".`
    );
  }

  if (decision.requiresHumanReview !== true) {
    throw new Error("Expected recommendation to require human review.");
  }

  console.log("Dry weather observation test passed.");
  console.log("Decision:");
  console.log(decision);
}

function testCropHealthObservationIsIgnored() {
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
        category: "crop_health",
        observation:
          "My maize leaves are being eaten by insects.",
        language: "dholuo",
      },
    ],

    weather: [],
    weatherStations: [],
  };

  const decision = evaluateWeatherDryness(context);

  if (decision !== null) {
    throw new Error(
      "Expected weather dryness rule to ignore a crop-health observation."
    );
  }

  console.log("Crop-health observation test passed.");
}

function testWeatherObservationWithoutDrynessIsIgnored() {
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
        id: "observation-3",
        category: "weather",
        observation:
          "It rained heavily yesterday.",
        language: "dholuo",
      },
    ],

    weather: [],
    weatherStations: [],
  };

  const decision = evaluateWeatherDryness(context);

  if (decision !== null) {
    throw new Error(
      "Expected unrelated weather observation to be ignored."
    );
  }

  console.log("Non-dry weather observation test passed.");
}

try {
  console.log("Running weather dryness rule tests...\n");

  testDryWeatherObservation();
  testCropHealthObservationIsIgnored();
  testWeatherObservationWithoutDrynessIsIgnored();

  console.log("All weather dryness rule tests passed.\n");
} catch (error) {
  console.error("Weather dryness rule test failed.");
  console.error(error);
  process.exit(1);
}