
import assert from "node:assert/strict";

import sequelize from "../../config/database.js";
import Farmer from "../../models/farmer.js";
import Farm from "../../models/farm.js";
import CropCycle from "../../models/cropCycle.js";
import FarmerObservation from "../../models/farmerObservation.js";
import Conversation from "../../models/conversation.js";
import Recommendation from "../../models/recommendation.js";

const API_URL = "http://localhost:7000/api/messages";

let farmer;
let farm;
let cropCycle;
let originalConversationId;

async function cleanup() {
  if (farmer?.id) {
    // Delete recommendations before observations they reference.
    await Recommendation.destroy({
      where: { farmerId: farmer.id },
    });

    // Delete conversations before their observations.
    await Conversation.destroy({
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

async function sendMessage(message) {
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
  console.log(JSON.stringify(data, null, 2));

  assert.equal(
    response.status,
    201,
    `Expected HTTP 201, received ${response.status}: ${
      data.message || data.error || "Unknown error"
    }`
  );

  assert.equal(data.success, true);

  return data;
}

async function runTest() {
  try {
    console.log("Creating test farmer, farm and crop...");

    farmer = await Farmer.create({
      name: "AgriMama Conversation Flow Test",
      phone: `+254718535840`,
      preferredLanguage: "en",
    });

    farm = await Farm.create({
      farmerId: farmer.id,
      name: "Conversation Flow Test Farm",
    });

    cropCycle = await CropCycle.create({
      farmId: farm.id,
      crop: "maize",
      variety: "test variety",
      plantingDate: new Date("2026-09-01"),
      currentStage: "vegetative",
      status: "active",
    });

    // --------------------------------------------------
    // MESSAGE 1: Send an ambiguous report.
    // --------------------------------------------------

    console.log("\nMESSAGE 1: Initial farmer report");

    const firstResponse = await sendMessage(
      "Something is wrong with my maize, but I am not sure what it is."
    );

    assert.equal(
      firstResponse.status,
      "needs_follow_up",
      "Expected the first message to request clarification."
    );

    assert.ok(
      firstResponse.observation?.id,
      "Expected the original observation to be saved."
    );

    assert.ok(
      firstResponse.conversation?.id,
      "Expected a conversation to be created."
    );

    assert.equal(
      firstResponse.conversation.status,
      "awaiting_reply"
    );

    assert.equal(
      firstResponse.conversation.observationId,
      firstResponse.observation.id,
      "Conversation should reference the original observation."
    );

    originalConversationId = firstResponse.conversation.id;

    console.log("\nPASS: Initial conversation created.");

    // Confirm the conversation was persisted.
    const savedConversation = await Conversation.findByPk(
      originalConversationId
    );

    assert.ok(savedConversation, "Conversation was not persisted.");

    // --------------------------------------------------
    // MESSAGE 2: Reply to the pending question.
    // --------------------------------------------------

    console.log("\nMESSAGE 2: Farmer replies to the question");

    const secondResponse = await sendMessage(
      "The leaves have holes and I can see insects."
    );

    assert.ok(
      secondResponse.observation?.id,
      "Expected the farmer's reply to be saved as an observation."
    );

    assert.notEqual(
      secondResponse.observation.id,
      firstResponse.observation.id,
      "The reply should have its own observation record."
    );

    assert.ok(
      secondResponse.conversation?.id,
      "Expected the updated conversation in the response."
    );

    assert.equal(
      secondResponse.conversation.id,
      originalConversationId,
      "The reply should update the original conversation, not create another."
    );

    assert.equal(
      secondResponse.conversation.answerObservationId,
      secondResponse.observation.id,
      "Conversation should reference the reply observation."
    );

    assert.equal(
      secondResponse.conversation.answer,
      "The leaves have holes and I can see insects."
    );

    // Verify the persisted state, not just the API response.
    const updatedConversation = await Conversation.findByPk(
      originalConversationId
    );

    assert.ok(updatedConversation);

    assert.equal(
      updatedConversation.answerObservationId,
      secondResponse.observation.id
    );

    assert.equal(
      updatedConversation.answer,
      "The leaves have holes and I can see insects."
    );

    const conversationCount = await Conversation.count({
      where: { farmerId: farmer.id },
    });

    assert.equal(
      conversationCount,
      1,
      "Expected the reply to reuse the existing conversation."
    );

    // --------------------------------------------------
    // Verify a valid outcome.
    // --------------------------------------------------

    if (secondResponse.status === "needs_follow_up") {
      assert.equal(
        updatedConversation.status,
        "awaiting_reply"
      );

      assert.ok(
        secondResponse.followUpQuestions?.length > 0,
        "Expected another clarification question."
      );

      console.log(
        "\nPASS: Reply saved and conversation remains open for clarification."
      );
    } else {
      assert.equal(secondResponse.status, "processed");

      assert.equal(
        updatedConversation.status,
        "completed"
      );

      assert.ok(
        updatedConversation.completedAt,
        "Expected completedAt to be set."
      );

      assert.ok(
        secondResponse.recommendation,
        "Expected a recommendation when clarification is complete."
      );

      assert.equal(
        secondResponse.recommendation.observationId,
        secondResponse.observation.id,
        "Recommendation should link to the reply observation."
      );

      assert.equal(
        secondResponse.recommendation.requiresHumanReview,
        true,
        "Recommendation should require human review."
      );

      console.log(
        "\nPASS: Conversation completed and recommendation generated."
      );
    }

    console.log("\nALL CONVERSATION FLOW ASSERTIONS PASSED.");
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
