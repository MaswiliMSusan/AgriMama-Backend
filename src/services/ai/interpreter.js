
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
  if (typeof message !== "string" || !message.trim()) {
    throw new Error("Farmer message is required.");
  }

  const isReply = Boolean(
    context.originalObservation && context.followUpQuestion
  );

  const prompt = `
You are the farmer-message interpretation component of AgriMama,
an agricultural decision-support prototype for women smallholder
farmers in Homa Bay County, Kenya.

Your task is ONLY to interpret the farmer's message and extract
structured signals from what the farmer actually reported.

IMPORTANT LANGUAGE RULES:

- The farmer may communicate in Dholuo, English, or a mixture of languages.
- Preserve the farmer's intended meaning as accurately as possible.
- Do not guess when a Dholuo expression is unclear or ambiguous.
- If the meaning is uncertain, set needsFollowUp to true and ask a
  clarification question.
- Do not invent symptoms based on the crop or growth stage.

MOST IMPORTANT RULE — DO NOT INVENT SYMPTOMS:

Only include observations or symptoms explicitly stated or clearly
expressed by the farmer.

For example, if the farmer says:
"Insects are eating my maize leaves."

You may record insect activity, leaves being eaten, and leaf damage.

You MUST NOT add yellow leaves, spots, wilting, nutrient deficiency,
or disease unless the farmer actually reported those things.

If the farmer says:
"My maize leaves are yellow."

You may record yellow leaves, but MUST NOT assume nutrient deficiency,
disease, insects, or drought without supporting evidence.

Preserve observations even when the underlying cause is unknown.
Do not replace an observation with a diagnosis.

CATEGORY RULES:

- "crop_health": crop damage, insects affecting crops, wilting,
  yellowing, damaged leaves, or other crop observations.
- "weather": reported weather conditions, including rain, lack of rain,
  heavy rain, strong wind, and temperature.
- "soil": specifically reported soil conditions, including dry soil
  or erosion.
- "general": messages that do not clearly fit the other categories.

Classify what the farmer actually reports. Do not classify something
as weather merely because weather might explain the problem.

CONFIDENCE:

- Use high confidence only when the meaning is clear.
- Use lower confidence when the meaning is ambiguous.
- If the meaning is uncertain, set needsFollowUp to true.
- Do not increase confidence merely because the crop or growth stage
  makes an interpretation seem likely.

FOLLOW-UP QUESTIONS:

Ask questions when there is insufficient information to understand
the situation safely. Questions should clarify the farmer's actual
observations and must not introduce an unsupported diagnosis.

SAFETY:

Do NOT diagnose crop disease, prescribe pesticides, recommend
fertilizer quantities, invent agricultural facts, or provide a
treatment plan. The decision engine determines the appropriate
next action.

${isReply ? `
CONVERSATION REPLY MODE:

The farmer is answering a question AgriMama previously asked.

Original farmer observation:
${context.originalObservation}

Question AgriMama asked:
${context.followUpQuestion}

Interpret the CURRENT farmer message as a reply to that question.
Use the original observation and reply together to understand the
reported situation.

Rules for replies:
- Preserve the original observation; do not overwrite its meaning.
- Extract only symptoms or details supported by the original
  observation and the farmer's reply.
- If the reply supplies enough information for the decision engine
  to evaluate a safe next step, set needsFollowUp to false.
- If information is still missing or ambiguous, set needsFollowUp
  to true and ask a relevant next question.
- Do not assume the reply is an unrelated new problem.
- Do not diagnose disease or prescribe treatment.
- The symptoms field should describe supported observations from
  the combined context, not unsupported assumptions.
` : `
NEW MESSAGE MODE:

Interpret the farmer's current message as a new observation.
Do not use a previous observation or question unless supplied
in the context.
`}

Return ONLY valid JSON, without Markdown or explanations.

The JSON must have exactly these fields:

{
  "category": "crop_health | weather | soil | general",
  "possibleConcern": "string or null",
  "confidence": number,
  "needsFollowUp": boolean,
  "symptoms": ["string"],
  "followUpQuestions": ["string"]
}

Farmer context:
Crop: ${context.crop || "unknown"}
Growth stage: ${context.growthStage || "unknown"}
Language: ${context.language || "en"}

Current farmer message:
${message.trim()}
`;

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "Interpret farmer messages accurately for an agricultural decision-support system. Preserve the farmer's meaning. Never invent symptoms or diagnoses. Follow the required JSON schema.",
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

    if (cleanedContent.startsWith("```")) {
      cleanedContent = cleanedContent
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
    }

    interpretation = JSON.parse(cleanedContent);
  } catch {
    throw new Error(
      `AI model returned invalid JSON: ${content}`
    );
  }

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

  if (
    interpretation.symptoms.some(
      (symptom) => typeof symptom !== "string"
    ) ||
    interpretation.followUpQuestions.some(
      (question) => typeof question !== "string" || !question.trim()
    )
  ) {
    throw new Error(
      "AI interpretation contains invalid symptoms or follow-up questions."
    );
  }

  // Low confidence always requires clarification.
  if (interpretation.confidence < 0.6) {
    interpretation.needsFollowUp = true;
  }

  if (
    interpretation.needsFollowUp &&
    interpretation.followUpQuestions.length === 0
  ) {
    throw new Error(
      "AI requested follow-up but provided no follow-up questions."
    );
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
