import "dotenv/config";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.AI_SANDBOX_API_KEY,
  baseURL: process.env.AI_SANDBOX_BASE_URL,
});

const MODEL =
  process.env.AI_SANDBOX_MODEL ||
  "bedrock-amazon-nova-lite-v1-0";

export async function interpretFarmerMessage(message, context = {}) {
  if (!message || !message.trim()) {
    throw new Error("Farmer message is required.");
  }

  const prompt = `
You are the farmer-message interpretation component of AgriMama,
an agricultural decision-support prototype for women smallholder
farmers in Homa Bay County, Kenya.

Your task is ONLY to interpret the farmer's message and extract
structured signals.

IMPORTANT LANGUAGE INTERPRETATION RULES:

- The farmer may write in Dholuo, English, or a mixture of both.
- If the farmer writes in Dholuo, first understand the meaning of
  the farmer's message before assigning a category.
- Preserve the meaning of the farmer's original message.
- Do not guess the meaning of an unfamiliar or ambiguous Dholuo phrase.
- If the meaning is uncertain, set needsFollowUp to true and ask a
  clarification question instead of guessing.
- Do not invent symptoms that the farmer did not mention.
- Do not convert an unclear message into a specific symptom.
- Do not assume that a word associated with rain means that the
  farmer is reporting a weather problem.
- Distinguish between weather conditions and the effect of weather
  on the farmer's crop.
- If the farmer describes something happening to the crop, classify
  the message according to the crop problem being described.
- If the farmer describes rainfall, lack of rainfall, excessive rain,
  or another environmental condition without describing a crop
  problem, classify it as weather.
- If the farmer describes a crop problem that may be related to
  weather, keep the category focused on what the farmer is actually
  reporting.
- When the farmer's meaning is unclear, prefer asking a clarification
  question rather than making an agricultural assumption.

Do NOT:
- diagnose a crop disease;
- prescribe pesticides;
- recommend fertilizer quantities;
- invent agricultural facts;
- provide a treatment plan.

The interpretation should represent what the farmer reported,
not what you think the underlying agricultural diagnosis is.

Return ONLY valid JSON. Do not include markdown or explanatory text.

The JSON must have exactly these fields:

{
  "category": "crop_health | weather | soil | general",
  "possibleConcern": "string or null",
  "confidence": number,
  "needsFollowUp": boolean,
  "symptoms": ["string"],
  "followUpQuestions": ["string"]
}

Category guidance:

crop_health:
Use when the farmer is describing something happening to the crop,
such as insects eating leaves, damaged leaves, wilting plants,
yellowing leaves, or another visible crop problem.

weather:
Use when the farmer is reporting weather or environmental conditions,
such as rain, lack of rain, heavy rain, strong wind, or unusually hot
conditions, without describing a specific crop problem.

soil:
Use when the farmer is describing soil conditions such as dry soil,
poor soil condition, erosion, or other soil-specific observations.

general:
Use when the message does not clearly fit the other categories.

Confidence:
- Use a high confidence only when the meaning is clear.
- Use a lower confidence when the meaning is uncertain.
- If the meaning is uncertain, set needsFollowUp to true.

Farmer context:
Crop: ${context.crop || "unknown"}
Growth stage: ${context.growthStage || "unknown"}
Language: ${context.language || "en"}

Farmer message:
${message}
`;

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You interpret farmer messages into structured JSON for an agricultural decision-support system. Accuracy and faithful interpretation are more important than guessing.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0,
  });

  const content = response.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AI model returned an empty response.");
  }

  let interpretation;

  try {
    let cleanedContent = content.trim();

    // Remove markdown code fences if the model returns them.
    if (cleanedContent.startsWith("```")) {
      cleanedContent = cleanedContent
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
    }

    interpretation = JSON.parse(cleanedContent);
  } catch (error) {
    throw new Error(
      `AI model returned invalid JSON: ${content}`
    );
  }

  // --------------------------------------------------
  // Validate required fields
  // --------------------------------------------------

  const allowedCategories = [
    "crop_health",
    "weather",
    "soil",
    "general",
  ];

  if (!allowedCategories.includes(interpretation.category)) {
    throw new Error(
      `AI returned an invalid category: ${interpretation.category}`
    );
  }

  if (
    typeof interpretation.confidence !== "number" ||
    interpretation.confidence < 0 ||
    interpretation.confidence > 1
  ) {
    throw new Error(
      "AI interpretation confidence must be a number between 0 and 1."
    );
  }

  if (typeof interpretation.needsFollowUp !== "boolean") {
    throw new Error(
      "AI interpretation needsFollowUp must be a boolean."
    );
  }

  if (!Array.isArray(interpretation.symptoms)) {
    throw new Error(
      "AI interpretation symptoms must be an array."
    );
  }

  if (!Array.isArray(interpretation.followUpQuestions)) {
    throw new Error(
      "AI interpretation followUpQuestions must be an array."
    );
  }

  // --------------------------------------------------
  // Safety check:
  // uncertain interpretation should trigger follow-up
  // --------------------------------------------------

  if (interpretation.confidence < 0.6) {
    interpretation.needsFollowUp = true;
  }

  return {
    ...interpretation,

    context: {
      crop: context.crop || null,
      growthStage: context.growthStage || null,
      language: context.language || "en",
    },
  };
}