import "dotenv/config";

const BASE_URL = (
  process.env.AI_SANDBOX_BASE_URL ||
  "https://gateway.sandbox.codeforafrica.org"
).replace(/\/+$/, "");

const KNOWLEDGE_BASE_ID =
  process.env.AI_SANDBOX_KNOWLEDGE_BASE_ID;

const API_KEY = process.env.AI_SANDBOX_API_KEY;

if (!API_KEY || !KNOWLEDGE_BASE_ID) {
  throw new Error(
    "Configure AI_SANDBOX_API_KEY and AI_SANDBOX_KNOWLEDGE_BASE_ID in .env."
  );
}

const response = await fetch(
  `${BASE_URL}/v1/vector_stores/${KNOWLEDGE_BASE_ID}/search`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: "Unique test phrase: maize rainfall retrieval check",
      max_num_results: 5,
    }),
  }
);

const text = await response.text();

if (!response.ok) {
  throw new Error(
    `Search failed (${response.status}): ${text.slice(0, 500)}`
  );
}

const data = JSON.parse(text);

console.log("Top-level keys:", Object.keys(data));

for (const key of ["data", "results", "matches"]) {
  if (Array.isArray(data[key])) {
    console.log(`Results array: ${key}`);
    console.log("Result count:", data[key].length);

    if (data[key].length > 0) {
      console.log(
        "First result keys:",
        Object.keys(data[key][0])
      );

      console.log(
        "First result structure:",
        JSON.stringify(data[key][0], null, 2).slice(0, 3000)
      );
    }

    break;
  }
}
