import "dotenv/config";
import { interpretFarmerMessage } from "../../services/ai/interpreter.js";

const MODEL =
  process.env.AI_SANDBOX_MODEL || "default";

const tests = [
  {
    name: "English crop health",
    message: "My maize leaves are being eaten by insects.",
    context: {
      crop: "maize",
      growthStage: "vegetative_growth",
      language: "en",
    },
    expectedCategory: "crop_health",
    expectedIndicators: ["insect", "pest", "leaf"],
  },

  {
    name: "Dholuo crop health",
    message: "Kute chamoe oboke mar bandochona.",
    context: {
      crop: "maize",
      growthStage: "vegetative_growth",
      language: "dholuo",
    },
    expectedCategory: "crop_health",
    expectedIndicators: ["insect", "pest", "leaf"],
  },

  {
    name: "Dholuo weather",
    message: "Koth osetho.",
    context: {
      crop: "maize",
      growthStage: "vegetative_growth",
      language: "dholuo",
    },
    expectedCategory: "weather",
    expectedIndicators: ["rain"],
  },

  {
    name: "Dholuo ambiguous",
    message: "Maize odak.",
    context: {
      crop: "maize",
      growthStage: "vegetative_growth",
      language: "dholuo",
    },
    expectedCategory: null,
    expectedIndicators: [],
  },
];

async function run() {
  console.log("🌍 AgriMama AI Interpreter Test Suite");
  console.log(`🤖 Model: ${MODEL}\n`);

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log("=".repeat(70));
    console.log(`🧪 ${test.name}`);
    console.log(`💬 "${test.message}"`);

    try {
      const result = await interpretFarmerMessage(
        test.message,
        test.context
      );

      console.log("\n🧠 Interpretation:");
      console.dir(result, { depth: null });

      // ---------------------------------------------
      // Category validation
      // ---------------------------------------------

      if (
        test.expectedCategory &&
        result.category !== test.expectedCategory
      ) {
        throw new Error(
          `Expected category "${test.expectedCategory}", received "${result.category}"`
        );
      }

      // ---------------------------------------------
      // Dholuo crop-health semantic validation
      // ---------------------------------------------

      if (
        test.name === "Dholuo crop health"
      ) {
        const interpretationText = [
          result.possibleConcern || "",
          ...(result.symptoms || []),
        ]
          .join(" ")
          .toLowerCase();

        const containsPestMeaning =
          interpretationText.includes("insect") ||
          interpretationText.includes("pest");

        const containsLeafMeaning =
          interpretationText.includes("leaf") ||
          interpretationText.includes("leaves");

        if (!containsPestMeaning) {
          throw new Error(
            "Dholuo interpretation did not preserve the insect/pest meaning."
          );
        }

        if (!containsLeafMeaning) {
          throw new Error(
            "Dholuo interpretation did not preserve the leaf-damage meaning."
          );
        }
      }

      // ---------------------------------------------
      // English crop-health validation
      // ---------------------------------------------

      if (
        test.name === "English crop health"
      ) {
        if (result.category !== "crop_health") {
          throw new Error(
            `Expected crop_health, received ${result.category}`
          );
        }

        const interpretationText = [
          result.possibleConcern || "",
          ...(result.symptoms || []),
        ]
          .join(" ")
          .toLowerCase();

        if (
          !interpretationText.includes("insect") &&
          !interpretationText.includes("pest")
        ) {
          throw new Error(
            "English interpretation did not identify insect/pest activity."
          );
        }
      }

      // ---------------------------------------------
      // Weather validation
      // ---------------------------------------------

      if (
        test.name === "Dholuo weather"
      ) {
        if (result.category !== "weather") {
          throw new Error(
            `Expected weather, received ${result.category}`
          );
        }
      }

      // ---------------------------------------------
      // Ambiguous message validation
      // ---------------------------------------------

      if (
        test.name === "Dholuo ambiguous"
      ) {
        if (!result.needsFollowUp) {
          throw new Error(
            "Expected ambiguous Dholuo message to require follow-up."
          );
        }
      }

      console.log("\n✅ PASSED");
      passed++;
    } catch (error) {
      console.error("\n❌ FAILED");
      console.error(error.message);
      failed++;
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(70));

  console.log(`Total:  ${tests.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }

  console.log("\n🎉 All interpreter tests passed!");
}

run().catch((error) => {
  console.error("\n❌ Interpreter test suite failed.");
  console.error(error);
  process.exit(1);
});