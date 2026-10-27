import assert from "node:assert/strict";
import { searchAgriMamaKnowledge } from "../src/services/ai/knowledgeSearch.js";

const query =
  "Unique test phrase: maize rainfall retrieval check";

console.log("Testing normal search...");
const cleaned = await searchAgriMamaKnowledge(query, 5);

const cleanedResults = cleaned.data ?? [];

const testMarker =
  "unique test phrase: maize rainfall retrieval check";

const containsTestDocument = (results) =>
  results.some((result) =>
    (result.content ?? []).some((item) =>
      String(item.text ?? "")
        .toLowerCase()
        .includes(testMarker)
    )
  );

assert.equal(
  containsTestDocument(cleanedResults),
  false,
  "The test document should be excluded from normal results."
);

console.log("PASS: Test document excluded from normal results.");
console.log("Cleaned results:", cleanedResults.length);

console.log("\nTesting raw search...");
const raw = await searchAgriMamaKnowledge(query, 5, {
  includeTestContent: true,
  deduplicate: false,
});

assert.equal(
  containsTestDocument(raw.data ?? []),
  true,
  "Raw search should retain the test document when it is retrieved."
);

console.log("PASS: Raw search can include the test document.");
console.log("Raw results:", raw.data.length);

console.log("\nLive knowledge cleanup tests passed.");
