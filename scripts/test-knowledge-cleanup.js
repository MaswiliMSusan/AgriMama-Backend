import assert from "node:assert/strict";
import { cleanSearchResponse } from "../src/services/ai/knowledgeSearch.js";

const sampleResponse = {
  object: "list",
  data: [
    {
      score: 0.95,
      content: [
        {
          type: "text",
          text: "AgriMama maize growth stages guidance.",
        },
      ],
    },
    {
      score: 0.90,
      content: [
        {
          type: "text",
          text: "AgriMama maize growth stages guidance.",
        },
      ],
    },
    {
      score: 0.85,
      content: [
        {
          type: "text",
          text: "AgriMama ingestion test. Unique test phrase: maize rainfall retrieval check.",
        },
      ],
    },
    {
      score: 0.80,
      content: [
        {
          type: "text",
          text: "CIP sweet potato planting guidance.",
        },
      ],
    },
  ],
};

const cleaned = cleanSearchResponse(sampleResponse);

assert.equal(cleaned.data.length, 2);
assert.equal(cleaned.data[0].score, 0.95);
assert.equal(cleaned.data[1].score, 0.80);

assert.equal(cleaned.object, "list");

const raw = cleanSearchResponse(sampleResponse, {
  includeTestContent: true,
  deduplicate: false,
});

assert.equal(raw.data.length, 4);

console.log("Knowledge cleanup tests passed.");
