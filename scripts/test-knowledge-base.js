import "dotenv/config";
import {
  searchAgriMamaKnowledge,
} from "../src/services/ai/knowledgeSearch.js";

const questions = [
  {
    chapter: "Maize varieties",
    query:
      "Which maize varieties are listed for Kenya? Include the variety names and source.",
    expectedTerms: ["KEPHIS", "variety"],
  },
  {
    chapter: "Maize growth stages",
    query:
      "What are the maize growth stages and the management actions listed for each stage?",
    expectedTerms: ["maize", "stage"],
  },
  {
    chapter: "Pest and disease identification",
    query:
      "What symptoms and identification clues are documented for maize pests and diseases?",
    expectedTerms: ["maize", "pest"],
  },
  {
    chapter: "Weather and crop risk",
    query:
      "What maize rainfall, dry-spell, and weather risks are documented, and what limitations apply to this guidance?",
    expectedTerms: ["rainfall", "weather"],
  },
  {
    chapter: "Sweet potato knowledge",
    query:
      "What sweet potato planting and crop management guidance is documented, and which source supports it?",
    expectedTerms: ["sweetpotato", "source"],
  },
  {
    chapter: "Source register",
    query:
      "Which sources have reuse restrictions? What permission is required for KALRO material, and what attribution is required for CIP material?",
    expectedTerms: ["KALRO", "CIP"],
  },
];

const RESULTS_TO_REQUEST = 5;
const RESULTS_TO_DISPLAY = 3;
const PREVIEW_LENGTH = 700;

/**
 * Extract searchable text from a result.
 */
function getResultText(result) {
  return (result.content ?? [])
    .map((item) => item.text ?? "")
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Remove exact duplicate text chunks.
 * Different chunks with different text are retained.
 */
function deduplicateResults(results = []) {
  const seen = new Set();

  return results.filter((result) => {
    const text = getResultText(result).toLowerCase();

    if (!text || seen.has(text)) {
      return false;
    }

    seen.add(text);
    return true;
  });
}

/**
 * Check whether a result contains the expected search terms.
 * This is a simple diagnostic, not a measure of factual correctness.
 */
function checkExpectedTerms(text, expectedTerms = []) {
  const normalizedText = text.toLowerCase();

  return expectedTerms.map((term) => ({
    term,
    found: normalizedText.includes(term.toLowerCase()),
  }));
}

for (const item of questions) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`CHAPTER: ${item.chapter}`);
  console.log(`QUERY: ${item.query}`);

  try {
    const response = await searchAgriMamaKnowledge(
      item.query,
      RESULTS_TO_REQUEST
    );

    // The search endpoint currently returns results in response.data.
    const results = Array.isArray(response?.data)
      ? response.data
      : [];

    const uniqueResults = deduplicateResults(results);

    console.log("\nRETRIEVAL SUMMARY");
    console.log("-----------------");
    console.log(`Results returned: ${results.length}`);
    console.log(`Unique results: ${uniqueResults.length}`);

    if (uniqueResults.length === 0) {
      console.log(
        "No usable results found. Check the response structure and API output."
      );

      if (!Array.isArray(response?.data)) {
        console.log(
          "Response keys:",
          Object.keys(response ?? {})
        );
      }

      continue;
    }

    console.log(
      `\nTOP ${Math.min(RESULTS_TO_DISPLAY, uniqueResults.length)} UNIQUE RESULTS`
    );

    for (
      const [index, result] of uniqueResults
        .slice(0, RESULTS_TO_DISPLAY)
        .entries()
    ) {
      const text = getResultText(result);
      const termChecks = checkExpectedTerms(
        text,
        item.expectedTerms
      );

      console.log(`\n--- Result ${index + 1} ---`);
      console.log(
        "Score:",
        typeof result.score === "number"
          ? result.score.toFixed(4)
          : "Not provided"
      );
      console.log("Filename:", result.filename ?? "Not provided");
      console.log("File ID:", result.file_id ?? "Not provided");
      console.log("Expected terms:", termChecks);

      console.log(
        "Text preview:",
        text.length > PREVIEW_LENGTH
          ? `${text.slice(0, PREVIEW_LENGTH)}...`
          : text
      );
    }
  } catch (error) {
    console.error("\nSEARCH ERROR:", error.message);
  }
}

console.log(`\n${"=".repeat(70)}`);
console.log("KNOWLEDGE BASE RETRIEVAL TESTS COMPLETED");
