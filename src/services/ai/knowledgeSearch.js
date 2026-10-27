import "dotenv/config";

const BASE_URL = (
  process.env.AI_SANDBOX_BASE_URL ||
  "https://gateway.sandbox.codeforafrica.org"
).replace(/\/+$/, "");

const KNOWLEDGE_BASE_ID =
  process.env.AI_SANDBOX_KNOWLEDGE_BASE_ID;

const API_KEY = process.env.AI_SANDBOX_API_KEY;

// Exact markers from the technical ingestion test document.
// Do not filter generic filenames because the sandbox may
// assign generated filenames to legitimate documents too.
const TEST_DOCUMENT_MARKERS = [
  "agrimama ingestion test",
  "unique test phrase: maize rainfall retrieval check",
];

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getResultText(result) {
  if (typeof result?.text === "string") {
    return result.text;
  }

  if (Array.isArray(result?.content)) {
    return result.content
      .map((item) => {
        if (typeof item === "string") return item;
        return item?.text ?? "";
      })
      .join(" ");
  }

  return "";
}

function isTestDocument(result) {
  const text = normalizeText(getResultText(result));

  return TEST_DOCUMENT_MARKERS.some((marker) =>
    text.includes(marker)
  );
}

function deduplicateResults(results) {
  const seen = new Set();

  return results.filter((result) => {
    const text = normalizeText(getResultText(result));

    // Keep results without extractable text instead of
    // accidentally discarding metadata-only results.
    if (!text) return true;

    if (seen.has(text)) return false;

    seen.add(text);
    return true;
  });
}

function cleanSearchResponse(data, options = {}) {
  const {
    includeTestContent = false,
    deduplicate = true,
  } = options;

  // Keep the original object structure and all top-level
  // metadata. Only transform a recognized results array.
  const resultsKey = ["data", "results", "matches"].find(
    (key) => Array.isArray(data?.[key])
  );

  if (!resultsKey) {
    // The response schema may differ from the expected shape.
    // Return it unchanged until that schema is confirmed.
    return data;
  }

  let results = data[resultsKey];

  if (!includeTestContent) {
    results = results.filter(
      (result) => !isTestDocument(result)
    );
  }

  if (deduplicate) {
    results = deduplicateResults(results);
  }

  return {
    ...data,
    [resultsKey]: results,
  };
}

export async function searchAgriMamaKnowledge(
  query,
  maxNumResults = 5,
  options = {}
) {
  if (!API_KEY) {
    throw new Error("AI_SANDBOX_API_KEY is not configured.");
  }

  if (!KNOWLEDGE_BASE_ID) {
    throw new Error(
      "AI_SANDBOX_KNOWLEDGE_BASE_ID is not configured."
    );
  }

  if (typeof query !== "string" || !query.trim()) {
    throw new Error("A knowledge search query is required.");
  }

  const resultLimit = Math.min(
    10,
    Math.max(1, Number(maxNumResults) || 5)
  );

  const response = await fetch(
    `${BASE_URL}/v1/vector_stores/${KNOWLEDGE_BASE_ID}/search`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: query.trim(),
        max_num_results: resultLimit,
      }),
    }
  );

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Knowledge search failed (${response.status}): ` +
      responseText.slice(0, 1000)
    );
  }

  let data;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      "Knowledge search returned invalid JSON."
    );
  }

  return cleanSearchResponse(data, options);
}

// Use this for unit tests of the cleaning logic if needed.
export { cleanSearchResponse };
