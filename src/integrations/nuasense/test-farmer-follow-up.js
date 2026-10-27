
import assert from "node:assert/strict";

import sequelize from "../../config/database.js";
import Farmer from "../../models/farmer.js";
import Farm from "../../models/farm.js";
import CropCycle from "../../models/cropCycle.js";
import FarmerObservation from "../../models/farmerObservation.js";
import Recommendation from "../../models/recommendation.js";

const API_URL = "http://localhost:7000/api/messages";

let farmer;
let farm;
let cropCycle;

async function cleanup() {
  if (farmer?.id) {
    await Recommendation.destroy({
      where: { farmerId: farmer.id },
    });

    await FarmerObservation.destroy({
      where: { farmerId: farmer.id },
    });
  }

  if (cropCycle?.id) {
    await CropCycle.destroy({
      where: { id: cropCycle.id },
    });
  }

  if (farm?.id) {
    await Farm.destroy({
      where: { id: farm.id },
    });
  }

  if (farmer?.id) {
    await Farmer.destroy({
      where: { id: farmer.id },
    });
  }
}

async function runTest() {
  try {
    // Create a unique test farmer.
    farmer = await Farmer.create({
      name: "AgriMama Follow-up Test Farmer",
      phone: `254704${Date.now().toString().slice(-6)}`,
      preferredLanguage: "en",
    });

    farm = await Farm.create({
      farmerId: farmer.id,
      name: "Follow-up Test Farm",
    });

    cropCycle = await CropCycle.create({
      farmId: farm.id,
      crop: "maize",
      variety: "test variety",
      plantingDate: new Date("2026-09-01"),
      currentStage: "vegetative",
      status: "active",
    });

    // This message deliberately provides very little detail.
    const message =
      "Something is wrong with my maize, but I am not sure what it is.";

    console.log("Sending an ambiguous farmer message...");
    console.log(`Message: ${message}`);

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone: farmer.phone,
        message,
        language: "en",
        channel: "sms",
      }),
    });

    const data = await response.json();

    console.log("\nHTTP status:", response.status);
    console.log("API response:");
    console.log(JSON.stringify(data, null, 2));

    // The API should accept the message for processing.
    assert.equal(
      response.status,
      201,
      "Expected HTTP 201 for a successfully processed message."
    );

    assert.equal(data.success, true);
    assert.equal(data.farmer.id, farmer.id);
    assert.ok(data.observation, "Expected the observation to be saved.");

    // These assertions verify the clarification branch specifically.
    assert.equal(
      data.status,
      "needs_follow_up",
      "The AI did not trigger the follow-up branch. Review the interpretation in the output."
    );

    assert.equal(
      data.interpretation.needsFollowUp,
      true,
      "Expected the AI to request clarification."
    );

    assert.ok(
      Array.isArray(data.followUpQuestions) &&
        data.followUpQuestions.length > 0,
      "Expected at least one follow-up question."
    );

    assert.equal(
      data.recommendation,
      null,
      "AgriMama should not generate a recommendation before clarification."
    );

    // Verify that the observation was actually persisted.
    const savedObservation = await FarmerObservation.findOne({
      where: {
        id: data.observation.id,
        farmerId: farmer.id,
      },
    });

    assert.ok(
      savedObservation,
      "The farmer observation was not found in the database."
    );

    console.log("\nPASS: The follow-up branch worked correctly.");
    console.log("Follow-up questions:", data.followUpQuestions);
    console.log("No recommendation was generated before clarification.");
  } finally {
    await cleanup();
    console.log("\nTest data cleaned up.");
  }
}

try {
  await runTest();
} catch (error) {
  console.error("\nTEST FAILED:", error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
