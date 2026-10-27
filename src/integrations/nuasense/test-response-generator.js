import "dotenv/config";
import { generateFarmerResponse } from "../../services/ai/responseGenerator.js";

async function run() {
  console.log("🗣️ Testing AgriMama farmer response generator...\n");

  console.log(
    `🤖 Model: ${
      process.env.AI_SANDBOX_MODEL || "default"
    }\n`
  );

  // --------------------------------------------------
  // Approved interpretation
  // --------------------------------------------------

  const interpretation = {
    category: "crop_health",
    possibleConcern: null,
    confidence: 0.8,
    needsFollowUp: false,
    symptoms: [
      "insect or pest activity",
      "leaves being eaten",
    ],
    followUpQuestions: [],
  };

  // --------------------------------------------------
  // Approved recommendation from decision engine
  // --------------------------------------------------

  const recommendation = {
    recommendation:
      "Inspect several affected plants and record what the leaf damage looks like before applying any pesticide.",

    reason:
      "The farmer has reported a crop-health problem, but the specific cause has not yet been confirmed. AgriMama should gather more information before recommending treatment.",
  };

  // --------------------------------------------------
  // Generate English response
  // --------------------------------------------------

  console.log("🇬🇧 ENGLISH RESPONSE\n");

  const englishResponse = await generateFarmerResponse({
    recommendation,
    interpretation,
    language: "en",
    crop: "maize",
    growthStage: "vegetative_growth",
  });

  console.log(englishResponse);

  if (!englishResponse || !englishResponse.trim()) {
    throw new Error(
      "English response generator returned an empty response."
    );
  }

  // --------------------------------------------------
  // Generate Dholuo response
  // --------------------------------------------------

  console.log("\n🌍 DHOLUO RESPONSE\n");

  const dholuoResponse = await generateFarmerResponse({
    recommendation,
    interpretation,
    language: "dholuo",
    crop: "maize",
    growthStage: "vegetative_growth",
  });

  console.log(dholuoResponse);

  if (!dholuoResponse || !dholuoResponse.trim()) {
    throw new Error(
      "Dholuo response generator returned an empty response."
    );
  }

  // --------------------------------------------------
  // Basic safety checks
  // --------------------------------------------------

  const forbiddenTerms = [
    "spray",
    "pesticide dose",
    "kg/ha",
    "fertilizer rate",
  ];

  const combinedResponse =
    `${englishResponse} ${dholuoResponse}`.toLowerCase();

  for (const term of forbiddenTerms) {
    if (combinedResponse.includes(term.toLowerCase())) {
      throw new Error(
        `Response generator introduced unsupported advice: "${term}"`
      );
    }
  }

  console.log("\n✅ Response generator test passed!");
}

run().catch((error) => {
  console.error("\n❌ Response generator test failed.");
  console.error("Error:", error.message);
  process.exit(1);
});