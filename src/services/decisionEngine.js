
import Recommendation from "../models/recommendation.js";
import { buildDecisionContext } from "./decisionContext.js";
import {
  evaluateRules,
  selectPrimaryDecision,
} from "./ruleEngine.js";

export async function generateRecommendation(
  cropCycleId,
  triggeringObservationId = null
) {
  if (!cropCycleId) {
    throw new Error("cropCycleId is required.");
  }

  // 1. Build decision context.
  const context = await buildDecisionContext(
    cropCycleId,
    triggeringObservationId
  );

  if (!context) {
    throw new Error("Decision context could not be built.");
  }

  if (!context.farmer) {
    throw new Error("Decision context is missing farmer information.");
  }

  if (!context.farm) {
    throw new Error("Decision context is missing farm information.");
  }

  if (!context.cropCycle) {
    throw new Error("Decision context is missing crop cycle information.");
  }

  // 2. Evaluate applicable rules.
  console.log("\n========== AGRIMAMA DECISION DEBUG ==========");

console.log("Triggering observation:", {
  id: context.triggeringObservation?.id,
  category: context.triggeringObservation?.category,
});

console.log("Forecast availability:", context.weatherForecast?.available);

console.log(
  "Forecast sources:",
  JSON.stringify(context.weatherForecast?.sources, null, 2)
);

const matchedRules = evaluateRules(context);

console.log(
  "Matched rules:",
  matchedRules.map((rule) => ({
    name: rule.name,
    priority: rule.priority,
    actionCode: rule.decision?.actionCode,
  }))
);

console.log("=============================================\n");

  // 3. Select one primary next action.
  let decision = selectPrimaryDecision(matchedRules);

  // 4. Conservative fallback if no rule matches.
  if (!decision) {
    decision = {
      type: "information",
      actionCode: "PROVIDE_MORE_INFORMATION",

      observationId:
        context.triggeringObservation?.id || null,

      recommendation:
        "Record more information about the situation and seek agricultural support if the problem continues or worsens.",

      reason:
        "AgriMama does not yet have enough information to provide a more specific recommendation.",

      priority: "normal",
      requiresHumanReview: true,
      source: "AgriMama decision engine",

      language:
        context.triggeringObservation?.language ||
        context.farmer.preferredLanguage ||
        "en",

      metadata: {
        rule: "fallback",
      },
    };
  }

  // 5. Persist the recommendation, including metadata.
  const createdRecommendation = await Recommendation.create({
    farmerId: context.farmer.id,
    farmId: context.farm.id,
    cropCycleId: context.cropCycle.id,

    observationId:
      decision.observationId ||
      context.triggeringObservation?.id ||
      null,

    type: decision.type,

    actionCode:
      decision.actionCode || "PROVIDE_MORE_INFORMATION",

    recommendation: decision.recommendation,
    reason: decision.reason,
    priority: decision.priority,
    status: "pending",
    source: decision.source,

    language:
      decision.language ||
      context.farmer.preferredLanguage ||
      "en",

    requiresHumanReview:
      decision.requiresHumanReview ?? true,

    metadata: {
      ...(decision.metadata || {}),
      weatherContext: {
        stationMeasurementCount: context.weather?.length || 0,
        forecastAvailable:
          context.weatherForecast?.available === true,
        forecastSource:
          context.weatherForecast?.sources?.[0]?.source || null,
      },
    },
  });

  return createdRecommendation;
}
