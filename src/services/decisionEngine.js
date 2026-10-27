
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

  // Build context, including the observation that triggered
  // this recommendation when one is supplied.
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

  // 1. Evaluate applicable rules.
  const matchedRules = evaluateRules(context);

  // 2. Select one primary next action.
  let decision = selectPrimaryDecision(matchedRules);

  // 3. Use a conservative fallback if no rule matches.
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

  // 4. Persist the recommendation.
  const createdRecommendation = await Recommendation.create({
    farmerId: context.farmer.id,
    farmId: context.farm.id,
    cropCycleId: context.cropCycle.id,

    // Associate the recommendation with the observation
    // that actually triggered the decision.
    observationId:
      decision.observationId ||
      context.triggeringObservation?.id ||
      null,

    type: decision.type,

    // Persist the action code for downstream response selection.
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
  });

  return createdRecommendation;
}
