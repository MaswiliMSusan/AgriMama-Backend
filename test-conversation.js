
import { interpretFarmerMessage } from "./src/services/ai/interpreter.js";

const originalMessage =
  "My maize leaves are turning yellow.";

const followUpQuestion =
  "Are all the leaves turning yellow, or only some of them?";

const farmerReply =
  "Only the lower leaves are turning yellow.";

async function runTest() {
  console.log("\n1. Testing a new farmer message");

  const initialResult = await interpretFarmerMessage(
    originalMessage,
    {
      crop: "maize",
      growthStage: "vegetative_growth",
      language: "en",
    }
  );

  console.log(JSON.stringify(initialResult, null, 2));

  console.log("\n2. Testing a farmer's clarification reply");

  const replyResult = await interpretFarmerMessage(
    farmerReply,
    {
      crop: "maize",
      growthStage: "vegetative_growth",
      language: "en",
      originalObservation: originalMessage,
      followUpQuestion,
    }
  );

  console.log(JSON.stringify(replyResult, null, 2));
}

runTest().catch((error) => {
  console.error("Conversation test failed:", error);
});
