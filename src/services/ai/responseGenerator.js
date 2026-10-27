import "dotenv/config";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.AI_SANDBOX_API_KEY,
  baseURL: process.env.AI_SANDBOX_BASE_URL,
});

const MODEL =
  process.env.AI_SANDBOX_MODEL ||
  "bedrock-meta-llama3-70b-instruct-v1-0";

export async function generateFarmerResponse({
  recommendation,
  interpretation,
  language = "en",
  crop = null,
  growthStage = null,
}) {
  if (!recommendation) {
    throw new Error("Recommendation is required.");
  }

  const prompt = `
You are the farmer-facing communication component of AgriMama,
an agricultural decision-support service for women smallholder
farmers in Homa Bay County, Kenya.

Your job is ONLY to communicate an already-approved recommendation
to the farmer.

The agricultural recommendation has already been produced by
AgriMama's decision engine.

You MUST NOT:
- create a new agricultural recommendation;
- change the recommendation;
- diagnose a disease;
- prescribe pesticides;
- recommend pesticide quantities or application rates;
- recommend fertilizer quantities;
- add agricultural facts that are not provided;
- invent symptoms;
- contradict the approved recommendation;
- introduce a different action;
- make assumptions about the farmer's situation.

Your responsibility is to explain the approved recommendation
clearly and naturally.

LANGUAGE:

The farmer's requested language is:
${language}

If language is "en":
- Respond in clear, simple English.

If language is "dholuo":
- Respond in natural, concise Dholuo.
- Preserve the meaning of the approved recommendation.
- Do not invent Dholuo words.
- Do not produce repetitive or looping text.
- Do not repeat the same word or phrase unnecessarily.
- Do not mix English and Dholuo unnecessarily.
- Do not translate word-for-word if that produces unnatural Dholuo.
- Keep the response short enough for SMS or WhatsApp.
- If you cannot confidently express the approved recommendation
  naturally in Dholuo, return exactly:

DHOLOU_TRANSLATION_UNCERTAIN

Do not return anything else when using that marker.

IMPORTANT DHOLOU SAFETY RULE:

Never compensate for uncertainty in Dholuo by producing repetitive,
nonsensical, invented, or partially translated text.

A short uncertainty response is safer than an incorrect Dholuo response.

FARMER CONTEXT:

Crop:
${crop || "unknown"}

Growth stage:
${growthStage || "unknown"}

Language:
${language}

FARMER'S INTERPRETATION:

${JSON.stringify(interpretation, null, 2)}

APPROVED RECOMMENDATION:

Recommendation:
${recommendation.recommendation}

Reason:
${recommendation.reason || "No additional reason provided."}

RESPONSE REQUIREMENTS:

The response should:
- acknowledge what the farmer reported;
- communicate the approved next action;
- briefly explain why the action is appropriate when a reason is available;
- be concise enough for SMS or WhatsApp;
- use simple farmer-friendly language;
- avoid technical system terminology;
- avoid mentioning AI, models, prompts, rules, or decision engines.

If the approved recommendation requires more information,
ask the farmer for that information.

Do not introduce any action that is not contained in the approved
recommendation.

Return ONLY the farmer-facing response.
Do not return JSON.
Do not use markdown.
Do not add quotation marks.
Do not explain your reasoning.
`;

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You communicate approved agricultural recommendations to farmers. Preserve the approved recommendation exactly. Never create new agricultural advice. When responding in Dholuo, prioritize natural and accurate language over completeness.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0,
  });

  const content = response.choices?.[0]?.message?.content;

  if (!content || !content.trim()) {
    throw new Error(
      "AI response generator returned an empty response."
    );
  }

  const cleanedResponse = content
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();

  // --------------------------------------------------
  // Dholuo uncertainty marker
  // --------------------------------------------------

  if (cleanedResponse === "DHOLOU_TRANSLATION_UNCERTAIN") {
    return cleanedResponse;
  }

  // --------------------------------------------------
  // Basic response validation
  // --------------------------------------------------

  if (cleanedResponse.length > 1000) {
    throw new Error(
      "AI response generator returned an excessively long response."
    );
  }

  // --------------------------------------------------
  // Detect excessive word repetition
  // --------------------------------------------------

  const words = cleanedResponse
    .toLowerCase()
    .replace(/[.,!?'"()]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 10) {
    const wordCounts = {};

    for (const word of words) {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }

    const excessiveRepetition = Object.entries(wordCounts).find(
      ([, count]) => count >= 5
    );

    if (excessiveRepetition) {
      throw new Error(
        `AI response contains excessive word repetition: "${excessiveRepetition[0]}".`
      );
    }
  }

  // --------------------------------------------------
  // Prevent accidental system-style responses
  // --------------------------------------------------

  const forbiddenSystemTerms = [
    "decision engine",
    "system prompt",
    "language model",
    "AI model",
    "agriculture model",
  ];

  const lowerResponse = cleanedResponse.toLowerCase();

  for (const term of forbiddenSystemTerms) {
    if (lowerResponse.includes(term)) {
      throw new Error(
        `AI response contains an internal system term: "${term}".`
      );
    }
  }

  return cleanedResponse;
}