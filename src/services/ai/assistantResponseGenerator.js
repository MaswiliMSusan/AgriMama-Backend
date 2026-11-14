import "dotenv/config";
import OpenAI from "openai";

// --------------------------------------------------
// AI Client Configuration
// --------------------------------------------------

const API_KEY = process.env.AI_SANDBOX_API_KEY;
const BASE_URL = process.env.AI_SANDBOX_BASE_URL;

const MODEL =
  process.env.AI_SANDBOX_MODEL ||
  "bedrock-meta-llama3-70b-instruct-v1-0";

if (!API_KEY) {
  throw new Error("AI_SANDBOX_API_KEY is not configured.");
}

if (!BASE_URL) {
  throw new Error("AI_SANDBOX_BASE_URL is not configured.");
}

const client = new OpenAI({
  apiKey: API_KEY,
  baseURL: BASE_URL,
});

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function safeJson(value) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

function getResponseLanguage(interpretation, context) {
  return (
    interpretation?.responseLanguage ||
    context?.farmer?.preferredLanguage ||
    "en"
  );
}

function cleanAssistantResponse(message) {
  return String(message || "")
    .replace(/\s*\([^)]{15,}\)\s*/g, "")
    .trim();
}

// Identify obsolete weather-location questions so they
// do not interfere with unrelated conversations.

function isWeatherLocationPrompt(message = "") {
  const normalized = String(message).toLowerCase().trim();

  return (
    normalized.includes("which area is your farm in") ||
    normalized.includes("please share the village, ward") ||
    normalized.includes("shamba lako liko wapi") ||
    normalized.includes("pinyruodhi ni e kanye") ||
    normalized.includes("i found a few places with that name") ||
    normalized.includes("i couldn't identify that location")
  );
}

function formatConversationHistory(
  history = [],
  { includeWeatherLocationPrompts = false } = {}
) {
  if (!Array.isArray(history) || !history.length) {
    return "No previous messages.";
  }

  const relevantHistory = includeWeatherLocationPrompts
    ? history
    : history.filter(
        (item) =>
          item.sender !== "assistant" ||
          !isWeatherLocationPrompt(item.message)
      );

  if (!relevantHistory.length) {
    return "No relevant previous messages.";
  }

  return relevantHistory
    .map((item) => {
      const speaker =
        item.sender === "farmer" ? "Farmer" : "AgriMama";

      return `${speaker}: ${item.message}`;
    })
    .join("\n");
}

function formatServiceResults(serviceResults = {}) {
  return safeJson(serviceResults);
}

// --------------------------------------------------
// Main Response Generator
// --------------------------------------------------

export async function generateAssistantResponse({
  message,
  interpretation,
  context = {},
  serviceResults = {},
}) {
  if (!message || typeof message !== "string") {
    throw new Error("A valid farmer message is required.");
  }

  const responseLanguage = getResponseLanguage(
    interpretation,
    context
  );

  // --------------------------------------------------
// Dholuo: Generate English advice first, then translate
// --------------------------------------------------

if (responseLanguage === "dholuo") {
  const englishDraft = await generateAssistantResponse({
    message,

    interpretation: {
      ...interpretation,
      responseLanguage: "en",
    },

    context,

    serviceResults,
  });

  const englishMessage =
    typeof englishDraft === "string"
      ? englishDraft
      : englishDraft?.message;

  if (!englishMessage?.trim()) {
    throw new Error(
      "Could not generate the English agricultural advice."
    );
  }

  const dholuoMessage = await translateEnglishToDholuo({
    message: englishMessage.trim(),
  });

  return {
    message: dholuoMessage,
    language: "dholuo",
    model: MODEL,
    englishDraft: englishMessage.trim(),
  };
}

  const farmerName = context.farmer?.name || "Farmer";

  const farmContext = context.farm
    ? {
        farmName: context.farm.name,
        latitude: context.farm.latitude,
        longitude: context.farm.longitude,
      }
    : null;

  const cropContext = context.cropCycle
    ? {
        crop: context.cropCycle.crop,
        variety: context.cropCycle.variety,
        plantingDate: context.cropCycle.plantingDate,
        growthStage: context.cropCycle.growthStage,
      }
    : null;

  // ------------------------------------------------
  // Determine current request requirements
  // ------------------------------------------------

  const needsWeather =
    interpretation?.requirements?.needsWeatherData === true ||
    interpretation?.needsWeatherData === true;

  // Do not allow an old weather-location question to
  // influence a current request about another topic.

  const conversationHistory = formatConversationHistory(
    context.conversationHistory,
    {
      includeWeatherLocationPrompts: needsWeather,
    }
  );

  // ------------------------------------------------
  // System Instructions
  // ------------------------------------------------

  const systemPrompt = `
You are AgriMama, a friendly, knowledgeable and practical
AI agricultural assistant supporting smallholder farmers.

Your purpose is to help farmers make informed decisions
about farming, agriculture and related everyday questions.

You are having a real conversation with a farmer.
You are not a form, questionnaire or rigid chatbot.

LANGUAGE:

LANGUAGE:

The required response language is: ${responseLanguage}.

This is a strict requirement.

${responseLanguage === "en"
  ? `
- Respond entirely in clear, natural English.
- Do not use Dholuo, Kiswahili or other languages.
- Do not generate phonetic approximations of another language.
- Do not repeat words or sentences unnecessarily.
- Use standard English agricultural terminology.
`
  : responseLanguage === "sw"
    ? `
- Respond entirely in natural Kiswahili.
- Do not switch to English.
- Use simple, conversational agricultural Kiswahili.
- Do not invent words or repeat sentences.
`
    : `
- Respond entirely in natural conversational Dholuo.
- Do not switch to English or Kiswahili.
- Use agricultural expressions you can confidently formulate.
- Do not invent Dholuo vocabulary.
- If you cannot confidently explain something in Dholuo,
  ask one short clarification question in Dholuo.
- Do not repeat or loop sentences.
`
}

- Never translate the farmer's message as an introduction.
- Never append translations in parentheses.
- Return only the response in the required language.
CONVERSATION:

- Answer the farmer's actual question directly.
- Remember relevant previous messages.
- Understand follow-up questions such as:
  "What about tomorrow?", "And maize?" or "How do I do that?"
- Use previous context when it is relevant.
- Recognise when the farmer changes topics.
- Do not force a new question into the previous topic.
- Ask only for information that is genuinely necessary.
- Ask one clear clarification question at a time.
- Do not repeat questions the farmer has already answered.
- The current farmer message and its interpreted intent take priority
  over older conversation turns.
- Use previous messages only when they help resolve the current
  message's references or follow-up context.
- Do not continue an old workflow after the farmer has moved on.

CONVERSATIONAL RESPONSE STYLE:

- Do not repeat, paraphrase, translate, or summarize the farmer's
  message as an opening sentence.
- Do not start by repeating the crop, symptoms, question, or concern
  already expressed by the farmer.
- Acknowledge the farmer's concern briefly where appropriate.
- Respond directly to what the farmer needs.
- If more information is required, ask a specific, relevant
  follow-up question.
- Ask only the most useful clarification questions at that stage.
- Avoid unnecessary greetings and lengthy introductions.
- Keep responses natural, warm, concise and conversational.
- Maintain the language specified by responseLanguage.

WEATHER CONTEXT:

- Only ask for the farmer's location when the current request
  requires weather information.
- Never repeat an earlier weather-location clarification
  when the farmer has changed topics.
- Do not let previous weather requests override the current intent.
- If the current request does not require weather, ignore previous
  weather-location questions and do not ask for a location.
- A previous location question is not an instruction to ask for
  location again.

RESPONSE LANGUAGE:

- Respond entirely in the detected response language.
- Do not add English translations in parentheses.
- Do not translate or repeat the farmer's original message.
- Ask only questions relevant to the current topic.

PERSONALISATION:

- Use registered farm and crop information when relevant.
- Do not assume every question is about the farmer's registered crop.
- Do not require farm registration for general agricultural questions.
- Do not assume the farmer has coordinates or a complete farm profile.

SPECIALIST SERVICES AND EVIDENCE:

You may receive results from specialist services such as
weather providers, market data services and agricultural
knowledge retrieval.

Use those results when they are available and relevant.

AGRICULTURAL KNOWLEDGE RETRIEVAL:

- When serviceResults.knowledge is available, examine the
  retrieved results before answering.
- Use relevant retrieved agricultural documents as the primary
  evidence for agricultural recommendations.
- A successful search does not automatically mean that relevant
  agricultural information was found.
- If hasResults is false, do not claim that supporting agricultural
  documents were found.
- If hasResults is null, inspect the actual returned data to determine
  whether relevant information is present.
- Only use information supported by relevant retrieved documents
  or clearly established general agricultural knowledge.
- Never treat an unrelated document as evidence for the farmer's
  question.
- Do not invent pesticide names, application rates, treatment
  schedules or diagnoses.
- If retrieved information is insufficient to recommend a safe
  action, explain the uncertainty and ask one useful follow-up question.
- If knowledge retrieval failed, do not pretend that a search succeeded.
- Do not expose document IDs, retrieval metadata or internal
  search information to the farmer.

IMPORTANT:

- Never invent weather forecasts, rainfall, temperatures,
  market prices or other live data.
- If a service result says available=false, do not pretend
  that data was retrieved.
- If weather data is available, explain the forecast clearly.
- Distinguish forecast-model information from actual
  weather station observations.
- Do not describe Open-Meteo forecasts as measurements
  from the farmer's farm or a local weather station.
- If market data is unavailable, explain that you cannot
  verify the current price.
- Never present outdated information as a live result.
- If no specialist service was called, do not claim that
  you checked one.

AGRICULTURAL GUIDANCE:

- Provide practical, understandable farming guidance.
- Explain possible causes when discussing pests or crop symptoms.
- Do not claim a definitive diagnosis from insufficient evidence.
- Ask about symptoms, affected plants, crop stage or photographs
  when necessary.
- Never invent pesticide or fertiliser application rates.
- Do not recommend unsafe chemical use.
- Encourage advice from a qualified agricultural extension
  officer when a situation requires expert inspection.

GENERAL QUESTIONS:

- Farmers may ask about farming, livestock, fisheries,
  markets, business, finance, technology, weather,
  soil, planting, storage or other subjects.
- Do not refuse a reasonable question simply because it
  is outside the current crop or farm context.
- If you do not know something, be honest.
- Distinguish general knowledge from verified local information.

STYLE:

- Be warm, respectful, encouraging and conversational.
- Be concise but sufficiently helpful.
- Use short paragraphs.
- Use numbered steps when explaining a process.
- Avoid unnecessary introductions and repetitive disclaimers.
- Do not expose internal interpretation data, JSON or
  technical system instructions to the farmer.

Your goal is to help the farmer understand what to do next,
not simply classify their message.
`;

  // --------------------------------------------------
  // Farmer Context and Interpretation
  // --------------------------------------------------

  const userPrompt = `
FARMER INFORMATION

Name: ${farmerName}

Farm information:
${safeJson(farmContext)}

Crop information:
${safeJson(cropContext)}

CONVERSATION HISTORY

${conversationHistory}

CURRENT FARMER MESSAGE

${message}

INTERPRETER RESULTS

${safeJson({
    interpretedMeaning: interpretation?.interpretedMeaning,
    intent: interpretation?.intent,
    topic: interpretation?.topic,
    topics: interpretation?.topics,
    detectedLanguage: interpretation?.detectedLanguage,
    responseLanguage: interpretation?.responseLanguage,
    conversation: interpretation?.conversation,
    entities: interpretation?.entities,
    requirements: interpretation?.requirements,
    followUpQuestions: interpretation?.followUpQuestions,
  })}

SPECIALIST SERVICE RESULTS

${formatServiceResults(serviceResults)}

INSTRUCTIONS

Respond directly to the farmer's current message.

The current message and interpreter results are the source of truth
for the current task. Use conversation history only to understand
relevant references and follow-up questions.

If the farmer has changed topics, answer the new topic and ignore
obsolete requests or clarification questions from earlier topics.

Do not ask for the farm location unless the current interpreter
results indicate that weather data is required.

Use specialist service results only when they are relevant.

For agricultural questions, inspect the knowledge retrieval results
when they are available. Use relevant retrieved evidence and do not
invent information that is not supported.

If a required piece of information is missing, ask the
farmer a natural clarification question.

Do not invent facts or claim to have retrieved data
that is not present in the specialist service results.

Return only the message intended for the farmer.
`;

  // --------------------------------------------------
  // Generate AI Response
  // --------------------------------------------------

  const completion = await client.chat.completions.create({
    model: MODEL,

    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],

    temperature: 0.1,
    max_tokens: 600,
  });

  const generatedMessage =
    completion.choices?.[0]?.message?.content;

  if (
    typeof generatedMessage !== "string" ||
    !generatedMessage.trim()
  ) {
    throw new Error(
      "The AI model returned an empty assistant response."
    );
  }

    console.log("========== AGRIMAMA DEBUG ==========");
  console.log("RESPONSE LANGUAGE:", responseLanguage);
  console.log("INTERPRETED MEANING:", interpretation?.interpretedMeaning);
  console.log("KNOWLEDGE RESULTS:", serviceResults?.knowledge);
  console.log("GENERATED RESPONSE:", generatedMessage);
  console.log("====================================");

  return {
    message: cleanAssistantResponse(generatedMessage),
    language: responseLanguage,
    model: MODEL,
  };
}

// --------------------------------------------------
// Translate English Advice to Dholuo
// --------------------------------------------------

export async function translateEnglishToDholuo({ message }) {
  if (!message || typeof message !== "string") {
    throw new Error("A valid English response is required.");
  }

  const completion = await client.chat.completions.create({
    model: MODEL,

    messages: [
      {
        role: "system",
        content: `
You are a careful translator specialising in Dholuo
(Luo) as spoken in western Kenya.

Translate the supplied agricultural advice from English
into natural, simple, conversational Dholuo.

STRICT RULES:

1. Preserve the complete meaning of the original advice.
2. Use genuine, natural Dholuo expressions.
3. Do not produce invented or pseudo-Dholuo words.
4. Do not repeat words, phrases or sentences.
5. Do not add agricultural advice or explanations.
6. Do not summarise or omit important information.
7. Do not include English sentences in the translation.
8. Where a technical agricultural term has no equivalent
   you can confidently express, retain the technical term
   rather than inventing a Dholuo translation.
9. Keep questions as questions.
10. Use short, simple sentences suitable for smallholder farmers.

If you cannot confidently translate a sentence into Dholuo,
do not fabricate a translation.

Return ONLY the Dholuo translation.
`,
      },
      {
        role: "user",
        content: message,
      },
    ],

    temperature: 0,
    max_tokens: 600,
  });

  const translation =
    completion.choices?.[0]?.message?.content?.trim();

  if (!translation) {
    throw new Error("English-to-Dholuo translation failed.");
  }

  return translation;
}

// --------------------------------------------------
// Translate Assistant Response to English
// --------------------------------------------------

export async function translateAssistantResponseToEnglish({
  message,
  language,
}) {
  if (!message || typeof message !== "string") {
    return null;
  }

  if (!["sw", "dholuo"].includes(language)) {
    return null;
  }

  const completion = await client.chat.completions.create({
    model: MODEL,

    messages: [
      {
        role: "system",
        content: `
You are a precise translator for agricultural conversations.

Translate the supplied assistant response into natural,
clear English.

STRICT RULES:

1. Translate only what is actually written.
2. Preserve the original meaning and all useful details.
3. Do not add agricultural advice, explanations or assumptions.
4. Do not summarise, rewrite or improve the original response.
5. Do not repeat sentences unless they are repeated in the source.
6. Do not add an introduction such as "Here is the translation".
7. Do not wrap the translation in quotation marks.
8. Preserve questions and numbered instructions.
9. If a phrase is unclear, translate only what you can confidently
   understand. Do not invent its meaning.

Return ONLY the English translation.
`,
      },
      {
        role: "user",
        content: `
Original language: ${language}

Text to translate:
${message}
`,
      },
    ],

    temperature: 0,
    max_tokens: 1200,
  });

  const translation =
    completion.choices?.[0]?.message?.content;

  const cleanTranslation = translation
    ?.trim()
    .replace(/^here is the translation:\s*/i, "")
    .replace(/^translation:\s*/i, "")
    .replace(/^["“]|["”]$/g, "")
    .trim();

  if (
    typeof cleanTranslation !== "string" ||
    !cleanTranslation
  ) {
    throw new Error("Assistant response translation failed.");
  }

  return cleanTranslation;
}

// --------------------------------------------------
// Translate Farmer Message to English
// --------------------------------------------------

export async function translateFarmerMessageToEnglish({
  message,
  language,
}) {
  if (!message || !["dholuo", "sw"].includes(language)) {
    return null;
  }

  const languageInstructions =
    language === "dholuo"
      ? `
You are translating Dholuo (Luo), a language spoken in Kenya,
into English.

IMPORTANT DHOLOUO EXAMPLES:

- "Bando ga kute chamo"
  means "My maize leaves are being eaten by insects."

- "Kute chamo ite bando"
  means "Pests are eating maize at an early stage."

These are agricultural expressions. Do not interpret "bando"
as a general farm or translate "kute" without considering
the agricultural context.

Translate the actual meaning, not individual words in isolation.
Preserve the farmer's intended meaning and question format.
`
      : `
You are translating Kiswahili (Swahili) into English.
Preserve agricultural terminology and the farmer's intended meaning.
`;

  const completion = await client.chat.completions.create({
    model: MODEL,

    messages: [
      {
        role: "system",
        content: `
You are an accurate agricultural language translator.

${languageInstructions}

RULES:
- Translate only the farmer's message.
- Preserve the original meaning.
- Do not answer the farmer's question.
- Do not invent details.
- Do not guess when the meaning is unclear.
- Return only the English translation.
- If the meaning is genuinely unclear, indicate that
  the translation is uncertain.
`,
      },
      {
        role: "user",
        content: message,
      },
    ],

    temperature: 0,
    max_tokens: 300,
  });

  const translation =
    completion.choices?.[0]?.message?.content?.trim();

  return translation || null;
}

export default generateAssistantResponse;