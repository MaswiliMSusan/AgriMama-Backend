
import { interpretFarmerMessage } from "../../services/ai/interpreter.js";

const testMessages = [
  {
    name: "English rainfall",
    message: "It has not rained for the last one week.",
    language: "en",
  },
  {
    name: "Kiswahili rainfall",
    message: "Mvua haijanyesha kwa wiki moja. Mahindi yangu yanaanza kunyauka.",
    language: "sw",
  },
  {
    name: "English forecast question",
    message: "Will it rain tomorrow? I want to know whether I should plant.",
    language: "en",
  },
  {
    name: "Mixed language",
    message: "Maize yangu imeanza kukauka because hakuna rain.",
    language: "en",
  },
  {
    name: "English pest concern",
    message: "Small insects are eating the leaves of my maize.",
    language: "en",
  },
  {
    name: "English planting question",
    message: "Is this a good time to plant maize?",
    language: "en",
  },
];

for (const test of testMessages) {
  console.log("\n=================================");
  console.log(test.name);
  console.log("Message:", test.message);

  try {
    const result = await interpretFarmerMessage(
      test.message,
      {
        crop: "maize",
        growthStage: "vegetative_growth",
        language: test.language,
      }
    );

    console.dir(result, { depth: null });
  } catch (error) {
    console.error("TEST FAILED:", error.message);
  }
}
