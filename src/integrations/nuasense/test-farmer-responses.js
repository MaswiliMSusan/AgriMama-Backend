import {
  getFarmerResponse,
} from "../../services/responses/farmerResponses.js";

function run() {
  console.log("🗣️ Testing AgriMama farmer response templates...\n");

  // --------------------------------------------------
  // English
  // --------------------------------------------------

  const english = getFarmerResponse(
    "INSPECT_CROP_DAMAGE",
    "en"
  );

  console.log("🇬🇧 ENGLISH:");
  console.log(english);

  if (english.status !== "ready") {
    throw new Error(
      "Expected English response to be ready."
    );
  }

  if (!english.message) {
    throw new Error(
      "Expected English response message."
    );
  }

  // --------------------------------------------------
  // Dholuo
  // --------------------------------------------------

  const dholuo = getFarmerResponse(
    "INSPECT_CROP_DAMAGE",
    "dholuo"
  );

  console.log("\n🌍 DHOLUO:");
  console.log(dholuo);

  if (dholuo.status !== "translation_unavailable") {
    throw new Error(
      "Dholuo response should remain unavailable until human-validated."
    );
  }

  // --------------------------------------------------
  // Unknown action
  // --------------------------------------------------

  let unknownActionFailed = false;

  try {
    getFarmerResponse(
      "UNKNOWN_ACTION",
      "en"
    );
  } catch (error) {
    unknownActionFailed = true;
    console.log(
      "\n✅ Unknown action correctly rejected."
    );
  }

  if (!unknownActionFailed) {
    throw new Error(
      "Unknown action should have been rejected."
    );
  }

  console.log(
    "\n✅ Farmer response template tests passed!"
  );
}

try {
  run();
} catch (error) {
  console.error(
    "\n❌ Farmer response template test failed."
  );

  console.error(
    "Error:",
    error.message
  );

  process.exit(1);
}