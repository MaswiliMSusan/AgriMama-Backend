import Conversation from "../../models/conversation.js";
import ConversationMessage from "../../models/conversationMessage.js";
import Farmer from "../../models/farmer.js";
import Farm from "../../models/farm.js";
import CropCycle from "../../models/cropCycle.js";
import { getWeatherForFarm } from "../weather/weatherProvider.js";
import { interpretFarmerMessage } from "./interpreter.js";
import { searchAgriMamaKnowledge } from "./knowledgeSearch.js";
import {
    generateAssistantResponse,
    translateFarmerMessageToEnglish,
    translateAssistantResponseToEnglish,
} from "./assistantResponseGenerator.js";

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const MAX_MESSAGE_LENGTH = 4000;
const HISTORY_LIMIT = 12;

function buildConversationSummary(messages = []) {
    if (!messages.length) return "No previous conversation.";

    return messages
        .map((item) => {
            const speaker =
                item.sender === "farmer" ? "Farmer" : "AgriMama";
            return `${speaker}: ${item.message}`;
        })
        .join("\n");
}

async function getFarmerFarmContext(farmerId) {
    const farms = await Farm.findAll({
        where: { farmerId },
        order: [["updatedAt", "DESC"]],
        limit: 5,
    });

    if (!farms.length) {
        return {
            farm: null,
            cropCycle: null,
        };
    }

    for (const farm of farms) {
        const cropCycle = await CropCycle.findOne({
            where: {
                farmId: farm.id,
                status: "active",
            },
            order: [["updatedAt", "DESC"]],
        });

        if (cropCycle) {
            return { farm, cropCycle };
        }
    }

    return {
        farm: farms[0],
        cropCycle: null,
    };
}

async function getRecentMessages(conversationId) {
    const messages = await ConversationMessage.findAll({
        where: { conversationId },
        order: [["createdAt", "DESC"]],
        limit: HISTORY_LIMIT,
    });

    return messages.reverse();
}

// --------------------------------------------------
// Agricultural Knowledge Helpers
// --------------------------------------------------

function getKnowledgeQuery(interpretation, farmerMessage) {
    const values = [
        interpretation?.interpretedMeaning,
        interpretation?.topic,
        ...(Array.isArray(interpretation?.topics)
            ? interpretation.topics
            : []),
        interpretation?.entities?.crop,
        interpretation?.entities?.pest,
    ];

    const symptoms = interpretation?.entities?.symptoms;

    if (Array.isArray(symptoms)) {
        values.push(...symptoms);
    } else if (typeof symptoms === "string") {
        values.push(symptoms);
    } else if (symptoms && typeof symptoms === "object") {
        values.push(
            ...Object.values(symptoms).filter(
                (value) => typeof value === "string"
            )
        );
    }

    const query = values
        .filter((value) => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
        .join(" ");

    // Prefer the interpreter's English meaning for retrieval.
    return query || farmerMessage;
}

function getKnowledgeResultsCount(data) {
    for (const key of ["results", "data", "matches"]) {
        if (Array.isArray(data?.[key])) {
            return data[key].length;
        }
    }

    return null;
}

// --------------------------------------------------
// Open-Meteo Geocoding
// --------------------------------------------------

async function geocodeFarmLocation(location) {
    const query = String(location || "").trim();

    if (!query) return { matches: [] };

    // Normalise spacing and common county spelling.
    const parts = query
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

    if (parts.length > 1) {
        parts[parts.length - 1] = parts[parts.length - 1]
            .replace(/\bhomabay\b/i, "Homa Bay");
    }

    const normalisedQuery = parts.join(", ");

    // Try the full location first, then the village name alone.
    const searchTerms = [
        normalisedQuery,
        parts[0],
    ].filter(
        (value, index, values) => values.indexOf(value) === index
    );

    const allMatches = [];

    for (const searchTerm of searchTerms) {
        const params = new URLSearchParams({
            name: searchTerm,
            count: "10",
            language: "en",
            format: "json",
            countryCode: "KE",
        });

        const response = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`,
            {
                headers: { Accept: "application/json" },
                signal: AbortSignal.timeout(12000),
            }
        );

        if (!response.ok) {
            throw new Error(
                `Location lookup failed (${response.status}).`
            );
        }

        const data = await response.json();

        // Diagnostic logging: inspect provider results before filtering.
        console.info("[AgriMama Geocoding]", {
            originalQuery: query,
            searchTerm,
            resultCount: data.results?.length || 0,
            results: (data.results || []).map((item) => ({
                name: item.name,
                admin1: item.admin1 || null,
                admin2: item.admin2 || null,
                country: item.country || null,
                country_code: item.country_code || null,
                latitude: item.latitude,
                longitude: item.longitude,
            })),
        });

        const matches = (data.results || [])
            .filter(
                (item) =>
                    Number.isFinite(Number(item.latitude)) &&
                    Number.isFinite(Number(item.longitude)) &&
                    item.country_code === "KE"
            )
            .map((item) => ({
                name: item.name,
                admin1: item.admin1 || null,
                admin2: item.admin2 || null,
                country: item.country || "Kenya",
                latitude: Number(item.latitude),
                longitude: Number(item.longitude),
            }));

        allMatches.push(...matches);

        if (allMatches.length > 0) break;
    }

    // Remove duplicate coordinates.
    const uniqueMatches = allMatches.filter(
        (item, index, values) =>
            values.findIndex(
                (other) =>
                    other.latitude === item.latitude &&
                    other.longitude === item.longitude
            ) === index
    );

    return { matches: uniqueMatches };
}

function formatLocationName(location) {
    return [
        location.name,
        location.admin1,
        location.admin2,
        location.country,
    ]
        .filter(Boolean)
        .filter(
            (value, index, values) => values.indexOf(value) === index
        )
        .join(", ");
}

function getLocationQuestion(language = "en") {
    if (language === "sw") {
        return "Shamba lako liko wapi? Tafadhali taja kijiji, kata au mji ulio karibu, pamoja na kaunti.";
    }

    if (language === "dholuo") {
        return "Pinyruodhi ni e kanye? Nyisa nying gweng' kata dala maduong' moloyo machiegni, kod county.";
    }

    return "Which area is your farm in? Please share the village, ward, or nearest town and the county.";
}

// --------------------------------------------------
// Main Assistant Service
// --------------------------------------------------

export async function processAssistantMessage({
    fastify,
    authenticatedUser,
    message,
    conversationId = null,
    channel = "dashboard",
}) {
    if (
        !authenticatedUser?.farmerId ||
        authenticatedUser.role !== "farmer"
    ) {
        throw new Error("A registered farmer account is required.");
    }

    if (typeof message !== "string" || !message.trim()) {
        throw new Error("Please enter a message.");
    }

    const farmerMessage = message.trim();

    if (farmerMessage.length > MAX_MESSAGE_LENGTH) {
        throw new Error(
            `Message is too long. Maximum length is ${MAX_MESSAGE_LENGTH} characters.`
        );
    }

    if (!["dashboard", "sms"].includes(channel)) {
        throw new Error("Unsupported conversation channel.");
    }

    const farmer = await Farmer.findByPk(
        authenticatedUser.farmerId
    );

    if (!farmer) {
        throw new Error("Farmer profile not found.");
    }

    // ------------------------------------------------
    // Load or create the conversation
    // ------------------------------------------------

    let conversation = null;

    if (conversationId) {
        conversation = await Conversation.findOne({
            where: {
                id: conversationId,
                farmerId: farmer.id,
                purpose: "ai_assistant",
            },
        });

        if (!conversation) {
            throw new Error("Assistant conversation not found.");
        }
    }

    const recentMessages = conversation
        ? await getRecentMessages(conversation.id)
        : [];

    const conversationSummary =
        buildConversationSummary(recentMessages);

    // ------------------------------------------------
    // Load optional farmer and farm context
    // ------------------------------------------------

    const { farm, cropCycle } =
        await getFarmerFarmContext(farmer.id);

    const interpretationContext = {
        language: farmer.preferredLanguage || "en",
        farmName: farm?.name || null,
        crop: cropCycle?.crop || null,
        growthStage: cropCycle?.currentStage || null,
        conversationSummary,
    };

    // ------------------------------------------------
    // Interpret the current message
    // ------------------------------------------------

    let interpretation = await interpretFarmerMessage(
        farmerMessage,
        interpretationContext
    );

    let pendingWeatherLocation =
        conversation?.metadata?.pendingWeatherLocation || null;

    fastify?.log?.info(
        {
            message: farmerMessage,
            intent: interpretation.intent,
            topic: interpretation.topic,
            conversation: interpretation.conversation,
            requirements: interpretation.requirements,
            pendingWeatherLocation,
        },
        "Assistant interpretation debug"
    );

    // ------------------------------------------------
    // Identify a weather-location reply
    // ------------------------------------------------

    const selectedLocationOption =
        pendingWeatherLocation?.ambiguousMatches &&
            /^\d+$/.test(farmerMessage)
            ? pendingWeatherLocation.ambiguousMatches[
                Number(farmerMessage) - 1
            ] || null
            : null;

    const hasLocationEntity =
        typeof interpretation.entities?.location === "string" &&
        interpretation.entities.location.trim().length > 0;

    const isWeatherLocationReply = Boolean(
        pendingWeatherLocation &&
        (selectedLocationOption || hasLocationEntity)
    );

    // If the farmer has changed the subject instead of answering
    // the outstanding location question, clear the old request.
    if (pendingWeatherLocation && !isWeatherLocationReply) {
        const updatedMetadata = {
            ...(conversation.metadata || {}),
        };

        delete updatedMetadata.pendingWeatherLocation;

        await conversation.update({
            metadata: updatedMetadata,
        });

        pendingWeatherLocation = null;
    }

    // Preserve the response language of the original weather request.
    if (pendingWeatherLocation?.responseLanguage) {
        interpretation.responseLanguage =
            pendingWeatherLocation.responseLanguage;
    }

    // ------------------------------------------------
    // Deterministic weather follow-up handling
    // ------------------------------------------------

    // Do not call the AI interpreter a second time.
    // The farmer has already answered the outstanding location question.

    if (isWeatherLocationReply && pendingWeatherLocation) {
        interpretation.intent = "answer_follow_up";
        interpretation.topic = "weather_other";
        interpretation.topics = ["weather_other"];

        interpretation.conversation = {
            ...(interpretation.conversation || {}),
            isFollowUp: true,
            isTopicChange: false,
            referencedTopic: "weather",
            referencedMessage:
                pendingWeatherLocation.originalQuestion,
        };

        interpretation.entities = {
            ...(interpretation.entities || {}),
            location: selectedLocationOption
                ? formatLocationName(selectedLocationOption)
                : farmerMessage,
        };

        interpretation.requirements = {
            ...(interpretation.requirements || {}),
            needsWeatherData: true,
            needsMarketData: false,
            needsKnowledgeRetrieval: false,
            needsFarmContext: false,
            needsCropHealthAssessment: false,
            needsGeneralReasoning: false,
        };

        interpretation.needsWeatherData = true;
    }

    fastify?.log?.info(
        {
            farmerId: farmer.id,
            conversationId: conversation?.id || null,
            detectedLanguage: interpretation.detectedLanguage,
            responseLanguage: interpretation.responseLanguage,
            intent: interpretation.intent,
            topic: interpretation.topic,
            topics: interpretation.topics,
            requirements: interpretation.requirements,
            isWeatherLocationReply,
        },
        "AgriMama assistant message interpreted"
    );

    // ------------------------------------------------
    // Create conversation if this is a new chat
    // ------------------------------------------------

    if (!conversation) {
        conversation = await Conversation.create({
            farmerId: farmer.id,
            farmId: null,
            cropCycleId: null,
            observationId: null,
            purpose: "ai_assistant",
            question: farmerMessage,
            answer: null,
            status: "completed",
            metadata: {},
            askedAt: new Date(),
            completedAt: new Date(),
        });
    }

    // ------------------------------------------------
    // Save farmer message
    // ------------------------------------------------

    await ConversationMessage.create({
        conversationId: conversation.id,
        sender: "farmer",
        message: farmerMessage,
        channel,
    });

    // ------------------------------------------------
    // Prepare context for response generation
    // ------------------------------------------------

    const assistantContext = {
        farmer: {
            id: farmer.id,
            name: farmer.name,
            preferredLanguage: farmer.preferredLanguage,
        },

        farm: farm
            ? {
                id: farm.id,
                name: farm.name,
                latitude: farm.latitude,
                longitude: farm.longitude,
            }
            : null,

        cropCycle: cropCycle
            ? {
                id: cropCycle.id,
                crop: cropCycle.crop,
                variety: cropCycle.variety,
                plantingDate: cropCycle.plantingDate,
                growthStage: cropCycle.currentStage,
            }
            : null,

        conversationHistory: recentMessages,
    };

    // ------------------------------------------------
    // Specialist service integrations
    // ------------------------------------------------

    const serviceResults = {};

    // --------------------------------------------------
    // Agricultural Knowledge Retrieval
    // --------------------------------------------------

    const needsKnowledge =
        interpretation.requirements?.needsKnowledgeRetrieval === true;

    if (needsKnowledge) {
        const knowledgeQuery = getKnowledgeQuery(
            interpretation,
            farmerMessage
        );

        try {
            const knowledge = await searchAgriMamaKnowledge(
                knowledgeQuery,
                5
            );

            const resultCount = getKnowledgeResultsCount(knowledge);

            serviceResults.knowledge = {
                available: true,
                hasResults: resultCount === null
                    ? null
                    : resultCount > 0,
                query: knowledgeQuery,
                resultCount,
                results: knowledge,
            };

            fastify?.log?.info(
    {
        knowledgeQuery,
        resultCount,
        knowledgeResults: knowledge,
    },
    "AgriMama knowledge retrieval details"
);

            fastify?.log?.info(
                { query: knowledgeQuery, resultCount },
                "AgriMama knowledge retrieval completed"
            );
        } catch (error) {
            fastify?.log?.error(
                { err: error, query: knowledgeQuery },
                "AgriMama knowledge retrieval failed"
            );

            serviceResults.knowledge = {
                available: false,
                hasResults: false,
                query: knowledgeQuery,
                resultCount: 0,
                results: [],
            };
        }
    }

    // A location follow-up must trigger the outstanding weather request,
    // even if the interpreter originally classified its topic as general.
    const needsWeather = Boolean(
        (pendingWeatherLocation && isWeatherLocationReply) ||
        interpretation.requirements?.needsWeatherData ||
        interpretation.needsWeatherData
    );

    if (needsWeather) {
        let weatherFarm = null;
        let resolvedLocation = null;

        // ------------------------------------------------
        // Case 1: Farmer has provided a location
        // or is responding to a location question.
        // ------------------------------------------------

        if (
            (pendingWeatherLocation && isWeatherLocationReply) ||
            interpretation.entities?.location
        ) {
            const locationText = selectedLocationOption
                ? formatLocationName(selectedLocationOption)
                : pendingWeatherLocation
                    ? farmerMessage
                    : interpretation.entities.location;

            const lookup = selectedLocationOption
                ? { matches: [selectedLocationOption] }
                : await geocodeFarmLocation(locationText);

            // No matching location found.
            if (!lookup.matches.length) {
                const clarification =
                    "I couldn't identify that location. Please share a nearby town or ward and the county.";

                await ConversationMessage.create({
                    conversationId: conversation.id,
                    sender: "assistant",
                    message: clarification,
                    channel,
                });

                await conversation.update({
                    answer: clarification,
                    status: "completed",
                    completedAt: new Date(),
                    metadata: {
                        ...(conversation.metadata || {}),
                        pendingWeatherLocation:
                            pendingWeatherLocation || {
                                originalQuestion: farmerMessage,
                                responseLanguage:
                                    interpretation.responseLanguage || "en",
                                requestedAt: new Date().toISOString(),
                            },
                        lastMessageAt: new Date().toISOString(),
                    },
                });

                return {
                    success: true,
                    conversationId: conversation.id,
                    requiresLocation: true,
                    message: {
                        farmer: farmerMessage,
                        assistant: clarification,
                    },
                };
            }

            // More than one location found.
            if (lookup.matches.length > 1) {
                const options = lookup.matches
                    .slice(0, 5)
                    .map(
                        (item, index) =>
                            `${index + 1}. ${formatLocationName(item)}`
                    )
                    .join("\n");

                const clarification =
                    `I found a few places with that name. Which one is your farm near?\n${options}\nPlease reply with the number or the full location.`;

                await ConversationMessage.create({
                    conversationId: conversation.id,
                    sender: "assistant",
                    message: clarification,
                    channel,
                });

                await conversation.update({
                    answer: clarification,
                    status: "completed",
                    completedAt: new Date(),
                    metadata: {
                        ...(conversation.metadata || {}),
                        pendingWeatherLocation: {
                            ...(pendingWeatherLocation || {
                                originalQuestion: farmerMessage,
                                responseLanguage:
                                    interpretation.responseLanguage || "en",
                                requestedAt: new Date().toISOString(),
                            }),
                            ambiguousMatches: lookup.matches.slice(0, 5),
                        },
                        lastMessageAt: new Date().toISOString(),
                    },
                });

                return {
                    success: true,
                    conversationId: conversation.id,
                    requiresLocation: true,
                    locationOptions: lookup.matches.slice(0, 5),
                    message: {
                        farmer: farmerMessage,
                        assistant: clarification,
                    },
                };
            }

            // One matching location found.
            resolvedLocation = lookup.matches[0];

            weatherFarm = {
                latitude: resolvedLocation.latitude,
                longitude: resolvedLocation.longitude,
            };
        }

        // ------------------------------------------------
        // Case 2: Use registered farm coordinates
        // ------------------------------------------------

        else if (
            farm &&
            farm.latitude !== null &&
            farm.latitude !== undefined &&
            farm.latitude !== "" &&
            farm.longitude !== null &&
            farm.longitude !== undefined &&
            farm.longitude !== "" &&
            Number.isFinite(Number(farm.latitude)) &&
            Number.isFinite(Number(farm.longitude))
        ) {
            weatherFarm = farm;
        }

        // ------------------------------------------------
        // Case 3: No coordinates or location provided.
        // Ask the farmer.
        // ------------------------------------------------

        else {
            const clarification = getLocationQuestion(
                interpretation.responseLanguage || "en"
            );

            await ConversationMessage.create({
                conversationId: conversation.id,
                sender: "assistant",
                message: clarification,
                channel,
            });

            await conversation.update({
                answer: clarification,
                status: "completed",
                completedAt: new Date(),
                metadata: {
                    ...(conversation.metadata || {}),
                    pendingWeatherLocation: {
                        originalQuestion: farmerMessage,
                        responseLanguage:
                            interpretation.responseLanguage || "en",
                        requestedAt: new Date().toISOString(),
                    },
                    lastMessageAt: new Date().toISOString(),
                },
            });

            return {
                success: true,
                conversationId: conversation.id,
                requiresLocation: true,
                message: {
                    farmer: farmerMessage,
                    assistant: clarification,
                },
            };
        }

        // ------------------------------------------------
        // Retrieve weather from Open-Meteo
        // ------------------------------------------------

        const weather = await getWeatherForFarm(weatherFarm);

        serviceResults.weather = {
            ...weather,
            ...(resolvedLocation
                ? {
                    resolvedLocation:
                        formatLocationName(resolvedLocation),
                    locationSource:
                        "farmer_provided_and_geocoded",
                }
                : {
                    locationSource:
                        "registered_farm_coordinates",
                }),
        };
    }

    // --------------------------------------------------
    // Generate the conversational response
    // --------------------------------------------------

    const generated = await generateAssistantResponse({
        message: pendingWeatherLocation
            ? pendingWeatherLocation.originalQuestion
            : farmerMessage,

        interpretation,

        context: {
            ...assistantContext,
            ...(pendingWeatherLocation
                ? {
                    farmerProvidedWeatherLocation: farmerMessage,
                }
                : {}),
        },

        serviceResults,
    });

    const assistantMessage =
        typeof generated === "string"
            ? generated
            : generated?.message;

    if (
        typeof assistantMessage !== "string" ||
        !assistantMessage.trim()
    ) {
        throw new Error(
            "Assistant response could not be generated."
        );
    }

    // --------------------------------------------------
    // Translate farmer message for display
    // --------------------------------------------------

    let farmerTranslation = null;

    const detectedLanguage = interpretation.detectedLanguage;

    if (["dholuo", "sw"].includes(detectedLanguage)) {
        try {
            farmerTranslation =
                await translateFarmerMessageToEnglish({
                    message: farmerMessage,
                    language: detectedLanguage,
                });
        } catch (error) {
            fastify?.log?.warn(
                { err: error },
                "Farmer message translation failed"
            );
        }
    }

    // --------------------------------------------------
    // Translate assistant response for demo/display
    // --------------------------------------------------

    // --------------------------------------------------
// Prepare English translation for demo/display
// --------------------------------------------------

let assistantTranslation = null;

if (detectedLanguage === "dholuo") {
    // The English advice was generated before Dholuo translation.
    // Reuse it instead of translating the Dholuo response back.
    assistantTranslation = generated?.englishDraft || null;

} else if (detectedLanguage === "sw") {
    // Kiswahili continues using the existing translation flow.
    try {
        assistantTranslation =
            await translateAssistantResponseToEnglish({
                message: assistantMessage.trim(),
                language: detectedLanguage,
            });
    } catch (error) {
        fastify?.log?.warn(
            { err: error },
            "Assistant response translation failed"
        );
    }
}

    // --------------------------------------------------
    // Save assistant response
    // --------------------------------------------------

    await ConversationMessage.create({
        conversationId: conversation.id,
        sender: "assistant",
        message: assistantMessage.trim(),
        channel,
    });

    // --------------------------------------------------
    // Update conversation
    // --------------------------------------------------

    await conversation.update({
        answer: assistantMessage.trim(),
        status: "completed",
        completedAt: new Date(),

        metadata: {
            ...(conversation.metadata || {}),

            ...(pendingWeatherLocation && serviceResults.weather?.available
                ? { pendingWeatherLocation: null }
                : {}),

            lastIntent: interpretation.intent,
            lastTopic: interpretation.topic,
            lastTopics: interpretation.topics,
            lastResponseLanguage: interpretation.responseLanguage,
            lastRequirements: interpretation.requirements,
            lastMessageAt: new Date().toISOString(),
        },
    });

    // --------------------------------------------------
    // Return response to API route
    // --------------------------------------------------

    return {
        success: true,

        conversationId: conversation.id,

        message: {
            farmer: farmerMessage,
            farmerTranslation,
            assistant: assistantMessage.trim(),
            assistantTranslation,
        },

        interpretation: {
            detectedLanguage: interpretation.detectedLanguage,
            languagesDetected: interpretation.languagesDetected,
            responseLanguage: interpretation.responseLanguage,
            intent: interpretation.intent,
            topic: interpretation.topic,
            topics: interpretation.topics,
            conversation: interpretation.conversation,
            requirements: interpretation.requirements,
            needsFollowUp: interpretation.needsFollowUp,
            followUpQuestions: interpretation.followUpQuestions,
        },

        createdAt: new Date().toISOString(),
    };
}

export default processAssistantMessage;