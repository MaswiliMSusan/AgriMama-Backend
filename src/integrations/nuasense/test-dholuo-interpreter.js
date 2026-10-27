import "dotenv/config";

import { interpretFarmerMessage } from "../../services/ai/interpreter.js";

async function run() {
  console.log("🌍 Testing AgriMama REAL AI with validated Dholuo...\n");

  // IMPORTANT:
  // Replace this with the exact Dholuo wording
  // validated by a fluent Homa Bay speaker.
  const message =
    "Kute chamo ite bando.";

  console.log("💬 Dholuo farmer message:");
  console.log(`"${message}"`);

  const result = await interpretFarmerMessage(message, {
    crop: "maize",
    growthStage: "vegetative_growth",
    language: "dholuo",
  });

  console.log("\n🧠 AI INTERPRETATION:");

  console.dir(result, {
    depth: null,
  });

  if (result.category !== "crop_health") {
    throw new Error(
      `Expected crop_health, received ${result.category}`
    );
  }

  if (
    typeof result.confidence !== "number" ||
    result.confidence < 0 ||
    result.confidence > 1
  ) {
    throw new Error(
      "Confidence must be between 0 and 1."
    );
  }

  if (!Array.isArray(result.symptoms)) {
    throw new Error(
      "Symptoms must be an array."
    );
  }

  if (!Array.isArray(result.followUpQuestions)) {
    throw new Error(
      "Follow-up questions must be an array."
    );
  }

  if (result.context?.language !== "dholuo") {
    throw new Error(
      "AI did not preserve Dholuo as the context language."
    );
  }

  console.log(
    "\n✅ Dholuo interpretation structure is valid."
  );

  console.log(
    "\n🔎 SEMANTIC REVIEW REQUIRED"
  );

  console.log(
    "Does the interpretation correctly identify insect/pest-related leaf damage?"
  );
}

run().catch((error) => {
  console.error(
    "\n❌ Dholuo interpreter test failed."
  );

  console.error(error);

  process.exit(1);
});