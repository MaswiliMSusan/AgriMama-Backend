import {
  evaluateRules,
  selectPrimaryDecision,
} from "../../services/ruleEngine.js";

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
      id: "observation-health",
      category: "crop_health",
      observation: "My maize leaves are being eaten by insects.",
      observedAt: new Date("2026-09-30T18:00:00Z"),
      language: "dholuo",
    },
    {
      id: "observation-weather",
      category: "weather",
      observation:
        "The rain has stopped and the soil is becoming dry.",
      observedAt: new Date("2026-09-30T17:00:00Z"),
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

console.log("🧠 Testing AgriMama rule engine...\n");

const matchedRules = evaluateRules(context);

console.log("📋 MATCHED RULES:");

for (const rule of matchedRules) {
  console.log(`   - ${rule.name} (priority ${rule.priority})`);
}

if (matchedRules.length !== 2) {
  throw new Error(
    `Expected 2 matching rules, but got ${matchedRules.length}.`
  );
}

const cropHealthMatch = matchedRules.find(
  (rule) => rule.name === "cropHealth"
);

const weatherDrynessMatch = matchedRules.find(
  (rule) => rule.name === "weatherDryness"
);

if (!cropHealthMatch) {
  throw new Error("Crop health rule did not match.");
}

if (!weatherDrynessMatch) {
  throw new Error("Weather dryness rule did not match.");
}

console.log("\n✓ Both rules matched successfully.");

const primaryDecision = selectPrimaryDecision(matchedRules);

if (!primaryDecision) {
  throw new Error("No primary decision was selected.");
}

console.log("\n🎯 PRIMARY DECISION:");
console.log(primaryDecision);

if (primaryDecision.source !== "AgriMama crop health rule") {
  throw new Error(
    `Expected crop health rule to be selected, got "${primaryDecision.source}".`
  );
}

console.log(
  "\n✓ Crop health rule was selected as the primary decision."
);

console.log(
  "\n✅ Rule engine multi-match test passed!"
);