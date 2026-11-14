import "dotenv/config";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.AI_SANDBOX_API_KEY,
  baseURL: process.env.AI_SANDBOX_BASE_URL,
});

const MODEL =
  process.env.AI_SANDBOX_MODEL ||
  "bedrock-meta-llama3-70b-instruct-v1-0";

// --------------------------------------------------
// Allowed interpretation values
// --------------------------------------------------

const ALLOWED_CATEGORIES = [
  "crop_health",
  "weather",
  "soil",
  "general",
];

const ALLOWED_LANGUAGES = [
  "en",
  "sw",
  "dholuo",
  "mixed",
  "unknown",
];

const ALLOWED_RESPONSE_LANGUAGES = [
  "en",
  "sw",
  "dholuo",
];

const ALLOWED_INTENTS = [
  "ask_weather_forecast",
  "report_weather_condition",
  "report_crop_problem",
  "ask_agricultural_advice",
  "ask_information",
  "answer_follow_up",
  "greeting",
  "other",
];

const ALLOWED_TOPICS = [
  "rainfall",
  "weather_other",
  "crop_health",
  "pest",
  "soil",
  "planting",
  "market",
  "general",
];

const ALLOWED_TIME_REFERENCES = [
  "past",
  "present",
  "future",
  "unspecified",
];

// --------------------------------------------------
// Main farmer message interpreter
// --------------------------------------------------

export async function interpretFarmerMessage(message, context = {}) {
  if (typeof message !== "string" || !message.trim()) {
    throw new Error("Farmer message is required.");
  }

  if (!process.env.AI_SANDBOX_API_KEY) {
    throw new Error("AI_SANDBOX_API_KEY is not configured.");
  }

  const isReply = Boolean(
    context.originalObservation && context.followUpQuestion
  );

  const preferredLanguage = [
    "en",
    "sw",
    "dholuo",
  ].includes(context.language)
    ? context.language
    : "en";

  const prompt = `
You are the multilingual agricultural interpretation component
of AgriMama, an agricultural decision-support service for
women smallholder farmers in Homa Bay County, Kenya.

Your responsibility is to understand EVERY message from the farmer,
identify what they want, detect the language, understand conversation
context and extract structured information for the AgriMama AI Assistant.

This is a general conversational assistant for farmers, not only a crop
observation or crop-health reporting tool. Farmers may ask about agriculture,
weather, crop health, pests, soil, planting, seeds, livestock, fisheries,
markets, prices, storage, post-harvest handling, farm business, finance,
technology, or general everyday questions.

Do not reject or force an unrelated question into an agricultural category.
Use the general topic and route the request for a helpful conversational
answer when it is outside the specialist agricultural topics.

You are NOT restricted to a predefined list of phrases, topics or keywords.

Understand meaning, context, natural language, spelling
variations, informal expressions and different ways farmers
communicate.

==================================================
1. MULTILINGUAL UNDERSTANDING
==================================================

Farmers may communicate in ANY language the model can understand,
including English, Kiswahili, Dholuo, other Kenyan languages, other
international languages, and mixtures of languages.

Identify the language actually used in the CURRENT message. Never assume
that the farmer is limited to English, Kiswahili or Dholuo.

Use standard language codes where possible (for example "en", "sw",
"fr", "ar", "pt"). Use "dholuo" for Dholuo/Luo, "mixed" when two or
more languages are meaningfully combined, and "unknown" only when the
language cannot reasonably be identified.

LANGUAGE MIXING RULES:

- Return languagesDetected as an array containing every
  language meaningfully used in the message, using language codes.
- Include only languages that contribute meaningful words
  or expressions.
- Do not count isolated borrowed words, crop names or technical
  terms as a separate language automatically.
- If the farmer meaningfully combines two or more languages,
  detectedLanguage MUST be "mixed".
- If only one language is meaningfully used, detectedLanguage
  must be its corresponding language code.
- responseLanguage must identify the dominant language.
- For mixed messages, choose the language that carries most
  of the sentence structure and meaning.
- Do not confuse the language of a technical or agricultural
  word with the dominant language.

For example:

"Maize yangu imeanza kukauka because hakuna rain."

Expected language identification:

detectedLanguage: "mixed"
languagesDetected: ["sw", "en"]
responseLanguage: "sw"

Do not assume the language from the farmer's profile.
Do not assume the language from the crop or location.
Do not require the farmer to translate their message into English.
Do not reject a message because it is written in a local language.

==================================================
2. UNIVERSAL CONVERSATION UNDERSTANDING
==================================================

Understand the farmer's actual purpose before classifying the topic.
The farmer may be asking a question, requesting an explanation, asking
for advice, sharing information, greeting the assistant, correcting an
earlier message, answering a question, or changing the subject.

Use the existing intent values for compatibility:
- ask_weather_forecast: asks for a weather forecast.
- report_weather_condition: reports observed weather or rainfall.
- report_crop_problem: reports crop damage, symptoms or pest activity.
- ask_agricultural_advice: asks what action to take about farming.
- ask_information: asks for facts, explanations, prices, definitions,
  comparisons or other information (including general questions).
- answer_follow_up: responds to a previous assistant question.
- greeting: greeting or conversational opening.
- other: anything not covered above.

Do not classify every agricultural question as report_crop_problem.
A question about maize prices is ask_information with market as the topic.
A question about soil improvement is ask_agricultural_advice or ask_information,
depending on whether the farmer asks what to do or asks for an explanation.
A question unrelated to agriculture is ask_information or other, with topic general.

Extract entities when present. Do not invent missing values:
- crop, livestock, animal, variety, farm, location, market
- date, time period, quantity, unit, price, currency
- weather condition, symptom, pest, soil condition
- product or input (seed, fertilizer, tool, medicine, etc.)
Use null for unknown or unstated values.

CONVERSATION CONTEXT:
- Identify whether this is a follow-up to the recent conversation.
- Identify whether the farmer is continuing the same topic or changing topic.
- Resolve references such as "it", "that one", "my maize" or "what about tomorrow"
  only when recent conversation or supplied farm context makes the reference clear.
- Do not let an old topic override a clearly new request.
- A farmer may switch topics at any time without starting a new chat.
- Do not ask the farmer to select a farm for general questions, market questions
  or other requests that do not need farm-specific context.
- Set needsFarmContext only when the answer materially depends on the farmer's
  registered farm, crop cycle, location or growing stage.

ROUTING REQUIREMENTS:
- needsWeatherData: current or forecast weather data is required.
- needsMarketData: current or recent market prices or market availability are required.
- needsKnowledgeRetrieval: AgriMama's curated agricultural knowledge may help.
- needsCropHealthAssessment: the farmer is reporting a crop-health concern.
- needsGeneralReasoning: explanation or reasoning is needed beyond a direct lookup.
Set each field independently. More than one may be true.
Never claim that data has been retrieved; these fields only describe what
another service should retrieve.

==================================================
3. MEANING AND INTERPRETATION
==================================================

Interpret the actual meaning of the farmer's message.

Return interpretedMeaning as a concise English explanation
for internal processing.

Preserve the farmer's intended meaning.
==================================================
4. NATIVE-SPEAKER-VALIDATED DHOLUO EXAMPLES
==================================================

The following exact Dholuo expressions have been checked with
a native speaker. Treat each as its own validated example;
do not assume that similar-looking expressions are interchangeable.

Example 1:
Farmer message: "Bando ga kute chamo"
Validated meaning: "My maize leaves are being eaten by insects."

For this exact expression, preserve the validated meaning:
- detectedLanguage: "dholuo"
- languagesDetected: ["dholuo"]
- responseLanguage: "dholuo"
- interpretedMeaning: "My maize leaves are being eaten by insects."
- intent: "report_crop_problem"
- topic: "pest"
- topics: ["pest", "crop_health"]
- category: "crop_health"
- possibleConcern: "insect damage"
- symptoms: ["maize leaves being eaten by insects"]
- needsWeatherData: false
- needsCropHealthAssessment: true

Example 2:
Farmer message: "Kute chamo ite bando."
Validated meaning: "Pests are eating the maize at an early stage."

For this exact expression, preserve the validated meaning:
- detectedLanguage: "dholuo"
- languagesDetected: ["dholuo"]
- responseLanguage: "dholuo"
- interpretedMeaning: "Pests are eating the maize at an early stage."
- intent: "report_crop_problem"
- topic: "pest"
- topics: ["pest", "crop_health"]
- category: "crop_health"
- possibleConcern: "pest damage to maize at an early growth stage"
- symptoms: ["pest damage to maize at an early growth stage"]
- needsWeatherData: false
- needsCropHealthAssessment: true

For both expressions, do NOT reinterpret the reported pest damage
as wilting, dryness, drought or another weather-related condition.

Do not add symptoms that the expressions do not report.

Do not assume that other Dholuo phrases have the same meaning.
Interpret unfamiliar expressions on their own evidence and ask
for clarification when genuinely uncertain.

==================================================
5. AGRICULTURAL AND GENERAL TOPIC RECOGNITION
==================================================

Return ALL relevant topics in the topics array.

Use the existing topic values for compatibility:

- "rainfall"
- "weather_other"
- "crop_health"
- "pest"
- "soil"
- "planting"
- "market"
- "general"

Topic guidance:

"rainfall":
Questions or reports concerning rain, lack of rain,
delayed rains, expected rainfall, heavy rainfall
or rainfall patterns.

"weather_other":
Temperature, wind or other weather conditions
not primarily about rainfall.

"crop_health":
Crop damage, wilting, yellowing and other crop
health observations.

"pest":
Explicitly reported or queried insects, pests
or organisms affecting crops.

"soil":
Soil conditions, including dry soil, erosion,
soil fertility, soil quality and soil improvement.

"planting":
Planting time, sowing, seed selection, spacing,
planting decisions and crop establishment.

"market":
Agricultural market prices, selling questions,
buyers, demand, supply and market availability.

"general":
Messages that do not clearly fit another topic,
including livestock, fisheries, farm business,
post-harvest handling, storage, agricultural finance,
technology and non-agricultural questions.

MULTIPLE TOPICS:

A farmer may report several concerns in one message.

Example:
"It has not rained for a week and my maize is wilting."

Expected topics:
["rainfall", "crop_health"]

Example:
"Insects are eating my maize leaves and the soil is dry."

Expected topics:
["pest", "crop_health", "soil"]

Example:
"Will it rain tomorrow? I want to plant maize."

Expected topics:
["rainfall", "planting"]

Example:
"How much is maize selling for in Homa Bay?"

Expected topics:
["market"]

Example:
"How can I keep my harvested maize safe from weevils?"

Expected topics:
["general", "pest"]

Do not discard secondary concerns because one topic
is more prominent.

The existing topic field must still contain ONE primary
topic for backward compatibility.

The existing category field must also contain ONE primary
category for backward compatibility.

Category mapping:
- crop_health or pest -> "crop_health" when the main concern
  is a reported crop problem.
- rainfall or weather_other -> "weather".
- soil -> "soil" when soil is the primary concern.
- all other topics -> "general".

Do not force a general question into crop health, weather
or soil simply because those categories already exist.

==================================================
6. TIME REFERENCE
==================================================

Identify the time period being discussed.

Return exactly one of:

- "past"
- "present"
- "future"
- "unspecified"

Examples:

"It did not rain last week" = past.

"It is raining now" = present.

"Will it rain tomorrow?" = future.

"How much is maize selling for today?" = present.

"Will the price improve next month?" = future.

If no time period is clear, use unspecified.

Do not confuse a past weather observation with
a future forecast request.

==================================================
7. INFORMATION AND SERVICE REQUIREMENTS
==================================================

Return the following boolean fields:

needsWeatherData
needsMarketData
needsKnowledgeRetrieval
needsFarmContext
needsCropHealthAssessment
needsGeneralReasoning

Set each field independently.

WEATHER:
Set needsWeatherData to true when current or forecast weather
information would materially help answer the farmer's question
or understand a reported weather condition.

Examples:
- Asking whether it will rain tomorrow: true.
- Asking about expected rainfall next week: true.
- Reporting a prolonged dry spell: true.
- Asking about current weather conditions: true.
- Reporting unrelated insect damage: false.

MARKET:
Set needsMarketData to true when the farmer asks about current
or recent prices, selling opportunities, buyers, market demand
or availability.

Examples:
- "How much is maize selling for today?" = true.
- "Where can I sell my sweet potatoes?" = true.
- "Why do maize prices change?" = false unless current data
  is also requested.

Do not invent current market prices.

KNOWLEDGE:
Set needsKnowledgeRetrieval to true when curated agricultural
information could materially help answer the question.

Examples:
- Asking how to identify a crop disease: true.
- Asking about suitable maize varieties: true.
- Asking how to improve soil fertility: true.
- Asking for a general greeting: false.

FARM CONTEXT:
Set needsFarmContext to true only when the answer materially
depends on the farmer's registered farm, crop cycle, location,
planting date, variety or growth stage.

Examples:
- "What should I do about my maize?" may require farm context
  if the current conversation does not identify the maize.
- "What is the best way to store maize?" does not automatically
  require registered farm context.
- "Will it rain tomorrow?" may require a location, but does not
  automatically require selecting a registered farm.
- "How much is maize selling for in Homa Bay?" does not require
  farm context.

CROP HEALTH:
Set needsCropHealthAssessment to true when the farmer reports
a crop-health concern that may need further assessment.

Do not set it merely because the farmer asks a general question
about crop diseases or pests.

GENERAL REASONING:
Set needsGeneralReasoning to true when the answer requires
explanation, comparison, interpretation or reasoning beyond
a simple data lookup.

Multiple requirements may be true at the same time.

IMPORTANT:
These fields identify which services may be useful.
They do not mean that those services have already been called
or that their information is available.

Do not invent weather measurements, forecasts, market prices
or agricultural evidence.

Weather forecasts must not be presented as proof of rainfall
actually received on the farm.

==================================================
8. DO NOT INVENT SYMPTOMS OR DIAGNOSES
==================================================

Only include observations or symptoms explicitly stated
or clearly expressed by the farmer.

Example:

If the farmer says:
"Insects are eating my maize leaves."

You may record insect activity and leaf damage.

You MUST NOT add yellow leaves, spots, wilting,
nutrient deficiency or disease.

If the farmer says:
"My maize leaves are yellow."

You may record yellow leaves.

You MUST NOT automatically assume nutrient deficiency,
disease, insects or drought.

Preserve observations even when the underlying cause
is unknown.

Do not replace an observation with a diagnosis.

PossibleConcern should describe a possible issue,
not a confirmed diagnosis.

==================================================
9. CONFIDENCE
==================================================

Return confidence between 0 and 1.

Use high confidence when the farmer's meaning is clear.

Use lower confidence when:
- The language is difficult to identify.
- A local expression is ambiguous.
- The meaning is unclear.
- Several interpretations are possible.

Language confidence and meaning confidence are different.

languageConfidence measures confidence in identifying
the language.

confidence measures confidence in understanding
the farmer's meaning.

Do not increase confidence merely because the crop,
location or growth stage makes an interpretation
seem likely.

If meaning confidence is below 0.6,
needsFollowUp MUST be true.
==================================================
10. FOLLOW-UP QUESTIONS
==================================================

Ask questions only when additional information is needed
to understand the farmer's request or respond safely.

Questions must:
- Be relevant to the actual message.
- Be simple and understandable.
- Be in the farmer's detected or dominant language.
- Avoid introducing unsupported diagnoses.
- Avoid asking for information already supplied.
- Ask only for the most important missing information.

Examples:

If a farmer asks:
"How much is maize selling for?"

If location is unknown, ask which market or location
they want prices for.

If a farmer asks:
"Will it rain tomorrow?"

If location is unknown and no registered farm location
is available, ask for their location.

If a farmer asks:
"How can I improve my soil?"

Do not automatically ask for farm selection.
Give general guidance where possible, and ask a relevant
clarification only if it materially changes the answer.

If the farmer's meaning is unclear, ask for clarification
without asking them to translate into English.

If needsFollowUp is true, provide at least one question.

If sufficient information is available, return an empty
followUpQuestions array.

==================================================
11. CONVERSATION CONTEXT AND TOPIC SWITCHING
==================================================

WEATHER LOCATION CLARIFICATION:

When the conversation context shows that AgriMama previously
asked the farmer for their location:

- Treat a short place name or location such as
  "Mikai, Homabay" as a possible answer to that question.
- Set intent to "answer_follow_up".
- Extract the supplied place into entities.location.
- Preserve the original weather request as the referenced context.
- Set needsWeatherData to true.
- Do not classify a location-only answer as a new agricultural topic.
- If the farmer clearly asks a different question instead,
  recognise the new request normally.

The farmer may continue a previous discussion, answer a
clarification question, introduce a new topic or return to
a topic discussed earlier.

Use the supplied conversation context to understand the
relationship between the current message and previous messages.

IMPORTANT DISTINCTION:

isFollowUp and isTopicChange are two different concepts.

A FOLLOW-UP means the current message continues, expands,
clarifies or refers to a previous topic or question.

A TOPIC CHANGE means the farmer introduces a different
subject or request from the immediately preceding discussion.

A topic change does not require the farmer to explicitly
announce that they are changing topics.

TOPIC CHANGE RULES:

Set conversation.isTopicChange = true when:

- The previous discussion was about soil and the farmer
  introduces a question about pests.
- The previous discussion was about weather and the farmer
  asks about market prices.
- The previous discussion was about crop health and the
  farmer asks about livestock.
- The previous discussion was about maize and the farmer
  introduces a separate question about another crop.
- The farmer introduces a clearly unrelated general question.
- The current message has a new, independently understandable
  intent that differs from the immediately preceding topic.

Set conversation.isTopicChange = false when:

- The farmer asks a follow-up about the same subject.
- The farmer provides additional information requested
  by AgriMama.
- The farmer asks for clarification about the previous answer.
- The farmer uses references such as "it", "that", "what
  about tomorrow?" or "how do I do that?" that clearly
  refer to the previous discussion.

FOLLOW-UP RULES:

Set conversation.isFollowUp = true when:

- The farmer refers to a previous question or answer.
- The farmer expands on the same subject.
- The farmer asks for more details about the previous advice.
- The farmer responds to a clarification question.
- The farmer uses a contextual reference that depends
  on previous messages.

Set conversation.isFollowUp = false when the farmer
introduces a new, independent request.

A new topic may still be related to agriculture.
Do not assume that two agricultural topics belong to
the same conversation topic.

IMPORTANT CLASSIFICATION EXAMPLES:

Example 1: Clear topic change

Previous conversation:
Farmer: How can I improve the fertility of my soil?
AgriMama: You can use compost and organic matter.

Current farmer message:
Bando ga kute chamo

Meaning:
My maize leaves are being eaten by insects.

Expected:
conversation.isFollowUp = false
conversation.isTopicChange = true
conversation.referencedTopic = null
conversation.referencedMessage = null

The new topic is pest and crop health.

Example 2: Follow-up on the same topic

Previous conversation:
Farmer: How can I improve the fertility of my soil?
AgriMama: You can use compost and organic matter.

Current farmer message:
What about using compost from kitchen waste?

Expected:
conversation.isFollowUp = true
conversation.isTopicChange = false
conversation.referencedTopic = "soil fertility"
conversation.referencedMessage =
"How can I improve the fertility of my soil?"

Example 3: Weather to market

Previous conversation:
Farmer: Will it rain tomorrow?
AgriMama: The forecast indicates possible rainfall.

Current farmer message:
How much is maize selling for in Homa Bay?

Expected:
conversation.isFollowUp = false
conversation.isTopicChange = true
conversation.referencedTopic = null
conversation.referencedMessage = null

Example 4: Answering a clarification question

Previous conversation:
Farmer: My maize leaves are turning yellow.
AgriMama: When did you first notice the yellowing?

Current farmer message:
About three days ago.

Expected:
conversation.isFollowUp = true
conversation.isTopicChange = false

The current message answers the previous clarification
question. Preserve the original crop-health context.

Example 5: Returning to an earlier topic

Previous conversation:
Farmer: How can I improve my soil?
AgriMama: You can use compost.

Farmer: What are the current maize prices?
AgriMama: Asks which market.

Current farmer message:
Back to the soil question, can I use cow manure?

Expected:
conversation.isFollowUp = true
conversation.isTopicChange = false
conversation.referencedTopic = "soil"

The farmer has explicitly returned to an earlier topic.

GENERAL RULES:

- Always compare the current message with the immediately
  preceding relevant discussion.
- Use the actual conversation history, not just the last
  message, to resolve references.
- A clearly new request takes priority over old context.
- Do not force a new topic into the previous topic.
- Do not discard useful context when the farmer returns
  to an earlier discussion.
- Do not invent missing conversation details.
- When the current message is ambiguous, use the recent
  conversation to resolve it. If it remains unclear,
  preserve uncertainty rather than inventing a connection.

LEGACY CROP OBSERVATION FOLLOW-UP:

${isReply ? `
The farmer is answering a question previously asked by AgriMama.

Original farmer observation:
${context.originalObservation}

Previous AgriMama question:
${context.followUpQuestion}

Interpret the CURRENT farmer message as a reply unless
the farmer clearly introduces a separate new request.

Rules:
- Combine the original observation and current reply.
- Preserve the original observation.
- Do not overwrite the original meaning.
- Identify the language of the CURRENT message.
- Set intent to "answer_follow_up" unless the farmer clearly
  introduces a separate new request.
- If enough information is available, needsFollowUp
  should be false.
- Otherwise ask a relevant next question.
- Do not invent symptoms or diagnoses.
- Include all relevant topics from the combined context.
` : `
This is not necessarily a reply to a crop observation.
Interpret the current message independently, using relevant
conversation history and supplied farmer context where available.
`}


==================================================
12. FARMER AND FARM CONTEXT
==================================================

The following information may be provided by AgriMama:

Farmer's preferred language:
${preferredLanguage}

Registered crop:
${context.crop || "unknown"}

Crop growth stage:
${context.growthStage || "unknown"}

Farm:
${context.farmName || "unknown"}

Farm location:
${context.location || "unknown"}

Recent conversation context:
${context.conversationSummary || "not provided"}

Use this information only when it is relevant to the current message.

Do not assume the farmer is asking about their registered crop
when they ask a general agricultural question.

Do not assume the farmer's current location from their farm
if they explicitly mention a different location.

Do not require farm or crop selection for general questions.

The farmer's preferred language is a fallback when the current
message cannot be confidently identified.

It must NOT override the language detected in the current message.

==================================================
13. SAFETY AND RELIABILITY
==================================================

You are an interpretation component, not a diagnostic engine
or agricultural recommendation engine.

DO NOT:

- Diagnose crop disease.
- Confirm a pest species without evidence.
- Prescribe pesticides.
- Recommend pesticide quantities or application rates.
- Recommend fertilizer quantities.
- Invent agricultural facts.
- Invent weather data.
- Invent market prices.
- Invent farm information.
- Claim that external services have been queried.
- Treat unverified knowledge as approved evidence.
- Assume a farmer's location, crop or circumstances.
- Ask the farmer to translate a local-language message into English.

Preserve uncertainty.

The assistant orchestration and response-generation services
will retrieve relevant evidence and determine how to respond.

==================================================
14. REQUIRED JSON RESPONSE
==================================================

Return ONLY valid JSON.

Do not include Markdown, explanations or code fences.

Return all the following fields:

{
  "detectedLanguage": "en | sw | dholuo | mixed | unknown | other language code",
  "languagesDetected": ["en", "sw"],
  "languageConfidence": 0.0,
  "responseLanguage": "en | sw | dholuo | other language code",
  "interpretedMeaning": "Concise English interpretation",

  "intent": "ask_weather_forecast | report_weather_condition | report_crop_problem | ask_agricultural_advice | ask_information | answer_follow_up | greeting | other",

  "topic": "rainfall | weather_other | crop_health | pest | soil | planting | market | general",
  "topics": ["general"],

  "entities": {
    "crop": null,
    "variety": null,
    "farm": null,
    "location": null,
    "market": null,
    "date": null,
    "timePeriod": null,
    "quantity": null,
    "unit": null,
    "price": null,
    "currency": null,
    "livestock": null,
    "pest": null,
    "symptoms": [],
    "other": []
  },

  "conversation": {
    "isFollowUp": false,
    "isTopicChange": false,
    "referencedTopic": null,
    "referencedMessage": null
  },

  "requirements": {
    "needsWeatherData": false,
    "needsMarketData": false,
    "needsKnowledgeRetrieval": false,
    "needsFarmContext": false,
    "needsCropHealthAssessment": false,
    "needsGeneralReasoning": false
  },

  "timeReference": "past | present | future | unspecified",
  "needsWeatherData": false,
  "category": "crop_health | weather | soil | general",
  "possibleConcern": null,
  "confidence": 0.0,
  "needsFollowUp": false,
  "symptoms": [],
  "followUpQuestions": []
}

RESPONSE REQUIREMENTS:

- Return every field.
- Use null for unknown scalar values.
- Use empty arrays when there are no items.
- Use true or false for boolean values.
- Confidence values must be between 0 and 1.
- detectedLanguage must reflect the actual message.
- responseLanguage must reflect the dominant language.
- topic must contain ONE primary topic.
- topics must contain ALL relevant topics.
- entities must contain only information supported by the message
  or supplied conversation context.
- conversation.isTopicChange must be true when the farmer
  introduces a clearly different subject from the immediately
  preceding discussion, even without explicitly announcing
  a topic change.
- conversation.isFollowUp must be true when the current message
  continues, clarifies or refers to a previous discussion.
- A new independent request must not be classified as a follow-up.
- A message answering a previous clarification question must
  be classified as a follow-up.
- Do not set isTopicChange to false merely because both topics
  are agricultural.
- requirements must describe what services are needed,
  not services that have already been called.
- needsWeatherData must match requirements.needsWeatherData.
- symptoms must not include invented observations.
- followUpQuestions must be empty when no clarification is needed.

==================================================
15. CURRENT FARMER MESSAGE
==================================================

CURRENT FARMER MESSAGE:

<farmer_message>
${message.trim()}
</farmer_message>

Interpret the message using the instructions above.
Return only the requested JSON.
`;
// --------------------------------------------------
// Call AI Sandbox model
// --------------------------------------------------

const response = await client.chat.completions.create({
  model: MODEL,
  messages: [
    {
      role: "system",
      content:
        "You are AgriMama's multilingual conversation interpreter. Understand farmer messages in any language you can support. Identify intent, topics, entities, context and service requirements. Return only valid JSON matching the requested structure. Never invent information.",
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

// --------------------------------------------------
// Parse JSON response
// --------------------------------------------------

let interpretation;

try {
  let cleanedContent = content.trim();

  // Remove Markdown code fences wherever they appear.
  cleanedContent = cleanedContent
    .replace(/```(?:json)?/gi, "")
    .trim();

  // Extract the JSON object even if the model adds
  // introductory or explanatory text.
  const firstBrace = cleanedContent.indexOf("{");
  const lastBrace = cleanedContent.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error("No JSON object found in AI response.");
  }

  const jsonContent = cleanedContent.slice(
    firstBrace,
    lastBrace + 1
  );

  interpretation = JSON.parse(jsonContent);

} catch (error) {
  throw new Error(
    `AI model returned invalid JSON: ${error.message}. Raw response: ${content}`
  );
}


// --------------------------------------------------
// Validate basic response structure
// --------------------------------------------------

if (
  !interpretation ||
  typeof interpretation !== "object" ||
  Array.isArray(interpretation)
) {
  throw new Error("AI interpretation must be a JSON object.");
}

// Maintain backward compatibility with the legacy weather field.
// If the AI omits it, derive it from the requirements object.
if (
  typeof interpretation.needsWeatherData !== "boolean" &&
  typeof interpretation.requirements?.needsWeatherData === "boolean"
) {
  interpretation.needsWeatherData =
    interpretation.requirements.needsWeatherData;
}

const requiredFields = [
  "detectedLanguage",
  "languagesDetected",
  "languageConfidence",
  "responseLanguage",
  "interpretedMeaning",
  "intent",
  "topic",
  "topics",
  "entities",
  "conversation",
  "requirements",
  "timeReference",
  "needsWeatherData",
  "category",
  "possibleConcern",
  "confidence",
  "needsFollowUp",
  "symptoms",
  "followUpQuestions",
];

for (const field of requiredFields) {
  if (!(field in interpretation)) {
    throw new Error(
      `AI interpretation is missing required field: ${field}`
    );
  }
}

// --------------------------------------------------
// Validate language fields
// --------------------------------------------------

// Language detection is extensible.
// Standard language codes and the special values below are accepted.
const validLanguageCode = (value) =>
  typeof value === "string" &&
  (
    value === "dholuo" ||
    /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value)
  );

if (
  !validLanguageCode(interpretation.detectedLanguage) &&
  !["mixed", "unknown"].includes(interpretation.detectedLanguage)
) {
  throw new Error(
    `AI returned an invalid detected language: ${interpretation.detectedLanguage}`
  );
}

if (!Array.isArray(interpretation.languagesDetected)) {
  throw new Error(
    "AI interpretation languagesDetected must be an array."
  );
}

if (
  interpretation.languagesDetected.some(
    (language) => !validLanguageCode(language)
  )
) {
  throw new Error(
    "AI interpretation contains an invalid language code."
  );
}

if (
  !validLanguageCode(interpretation.responseLanguage)
) {
  throw new Error(
    `AI returned an invalid response language: ${interpretation.responseLanguage}`
  );
}

if (
  typeof interpretation.languageConfidence !== "number" ||
  interpretation.languageConfidence < 0 ||
  interpretation.languageConfidence > 1
) {
  throw new Error(
    "AI language confidence must be between 0 and 1."
  );
}


// Normalize topic aliases returned by the AI before validation.
const TOPIC_ALIASES = {
  weather: "weather_other",
  weather_forecast: "weather_other",
  weather_conditions: "weather_other",
  crop_disease: "crop_health",
  crop_problem: "crop_health",
  insects: "pest",
  pest_control: "pest",
  market_prices: "market",
  soil_health: "soil",
  planting_advice: "planting",
};

const normalizeTopic = (topic) => {
  if (typeof topic !== "string") return topic;

  const normalized = topic.trim().toLowerCase();

  return TOPIC_ALIASES[normalized] || normalized;
};

// Normalize the primary topic.
interpretation.topic = normalizeTopic(interpretation.topic);

// Normalize all additional topics.
if (Array.isArray(interpretation.topics)) {
  interpretation.topics = interpretation.topics.map(normalizeTopic);
}
// --------------------------------------------------
// Validate intent and topic
// --------------------------------------------------

if (!ALLOWED_INTENTS.includes(interpretation.intent)) {
  throw new Error(
    `AI returned an invalid intent: ${interpretation.intent}`
  );
}

// Normalize topic aliases returned by the AI.


// Normalize the primary topic.
interpretation.topic = normalizeTopic(interpretation.topic);

// Normalize additional topics.
if (Array.isArray(interpretation.topics)) {
  interpretation.topics = interpretation.topics.map(normalizeTopic);
}

// Validate the primary topic.
if (!ALLOWED_TOPICS.includes(interpretation.topic)) {
  throw new Error(
    `AI returned an invalid primary topic: ${interpretation.topic}`
  );
}

// Validate and normalize the topics array.
if (!Array.isArray(interpretation.topics)) {
  interpretation.topics = [];
}

interpretation.topics = interpretation.topics.filter((topic) =>
  ALLOWED_TOPICS.includes(topic)
);

if (interpretation.topics.length === 0) {
  interpretation.topics = [interpretation.topic];
}

if (!interpretation.topics.includes(interpretation.topic)) {
  interpretation.topics.unshift(interpretation.topic);
}

// --------------------------------------------------
// Validate and normalize topics
// --------------------------------------------------

// The primary topic must always be valid.
if (!ALLOWED_TOPICS.includes(interpretation.topic)) {
  throw new Error(
    `AI returned an invalid primary topic: ${interpretation.topic}`
  );
}

// Some short messages, especially location-only replies,
// may produce an empty or incomplete topics array.
// Retain valid topics and use the primary topic as fallback.
if (!Array.isArray(interpretation.topics)) {
  interpretation.topics = [];
}

interpretation.topics = interpretation.topics.filter(
  (topic) => ALLOWED_TOPICS.includes(topic)
);

if (interpretation.topics.length === 0) {
  interpretation.topics = [interpretation.topic];
}

// Ensure the primary topic is included.
if (!interpretation.topics.includes(interpretation.topic)) {
  interpretation.topics.unshift(interpretation.topic);
}

// --------------------------------------------------
// Validate time reference and category
// --------------------------------------------------

if (
  !ALLOWED_TIME_REFERENCES.includes(
    interpretation.timeReference
  )
) {
  throw new Error(
    `AI returned an invalid time reference: ${interpretation.timeReference}`
  );
}

if (!ALLOWED_CATEGORIES.includes(interpretation.category)) {
  throw new Error(
    `AI returned an invalid category: ${interpretation.category}`
  );
}

// --------------------------------------------------
// Validate confidence and boolean fields
// --------------------------------------------------

if (
  typeof interpretation.confidence !== "number" ||
  interpretation.confidence < 0 ||
  interpretation.confidence > 1
) {
  throw new Error(
    "AI interpretation confidence must be between 0 and 1."
  );
}

const booleanFields = [
  "needsWeatherData",
  "needsFollowUp",
  "conversation.isFollowUp",
  "conversation.isTopicChange",
  "requirements.needsWeatherData",
  "requirements.needsMarketData",
  "requirements.needsKnowledgeRetrieval",
  "requirements.needsFarmContext",
  "requirements.needsCropHealthAssessment",
  "requirements.needsGeneralReasoning",
];

for (const field of booleanFields) {
  const value = field
    .split(".")
    .reduce((object, key) => object?.[key], interpretation);

  if (typeof value !== "boolean") {
    throw new Error(
      `AI interpretation field ${field} must be a boolean.`
    );
  }
}

// --------------------------------------------------
// Validate entities and conversation
// --------------------------------------------------

if (
  !interpretation.entities ||
  typeof interpretation.entities !== "object" ||
  Array.isArray(interpretation.entities)
) {
  throw new Error("AI interpretation entities must be an object.");
}

if (
  !interpretation.conversation ||
  typeof interpretation.conversation !== "object"
) {
  throw new Error(
    "AI interpretation conversation must be an object."
  );
}

if (
  !interpretation.requirements ||
  typeof interpretation.requirements !== "object"
) {
  throw new Error(
    "AI interpretation requirements must be an object."
  );
}

// --------------------------------------------------
// Validate meaning, symptoms and follow-up questions
// --------------------------------------------------

if (
  typeof interpretation.interpretedMeaning !== "string" ||
  !interpretation.interpretedMeaning.trim()
) {
  throw new Error(
    "AI interpretation must provide an interpreted meaning."
  );
}

if (
  interpretation.possibleConcern !== null &&
  typeof interpretation.possibleConcern !== "string"
) {
  throw new Error(
    "AI possibleConcern must be a string or null."
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
    (question) =>
      typeof question !== "string" || !question.trim()
  )
) {
  throw new Error(
    "AI interpretation contains invalid symptoms or follow-up questions."
  );
}

// --------------------------------------------------
// Apply consistency safeguards
// --------------------------------------------------

// The legacy weather field and the new requirements object
// must always agree. The legacy field remains available to
// existing services.

interpretation.needsWeatherData =
  interpretation.requirements.needsWeatherData;

// If language detection is uncertain, use the farmer's
// saved language preference as a fallback.

if (
  interpretation.detectedLanguage === "unknown" &&
  interpretation.languageConfidence < 0.6
) {
  interpretation.responseLanguage = preferredLanguage;
}

// Low interpretation confidence always requires clarification.

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
// --------------------------------------------------
// Return structured interpretation
// --------------------------------------------------

return {
  ...interpretation,

  // Preserve the farmer's original wording.
  originalMessage: message.trim(),

  // Preserve existing context fields for compatibility
  // with the current decision engine and other services.
  context: {
    crop: context.crop || null,
    growthStage: context.growthStage || null,
    language: context.language || "en",
    farmName: context.farmName || null,
    location: context.location || null,
  },
};
}