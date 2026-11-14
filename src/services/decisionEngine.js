
import Recommendation from "../models/recommendation.js";
import { buildDecisionContext } from "./decisionContext.js";
import {
  evaluateRules,
  selectPrimaryDecision,
} from "./ruleEngine.js";

import {
  getKnowledgeForReasoning,
} from "../services/knowledge/knowledgeService.js";

import {
  matchKnowledgeToObservation,
} from "../services/knowledge/knowledgeMatcher.js";


function buildKnowledgeQuery(context) {
  const observation = context.triggeringObservation || {};
  const cropCycle = context.cropCycle || {};

  const crop =
    cropCycle.crop ||
    cropCycle.cropName ||
    cropCycle.cropType ||
    "";

  const category = observation.category || "";

  const observationDetails = [
    observation.description,
    observation.notes,
    observation.message,
    observation.value,
  ]
    .filter(
      (value) =>
        typeof value === "string" && value.trim()
    )
    .join(" ");

  return {
    crop,
    category,

    query: [
      crop,
      category,
      observationDetails,
    ]
      .filter(Boolean)
      .join(" ")
      .trim(),
  };
}


/**
 * Retrieve eligible evidence from the AI Sandbox knowledge service.
 *
 * This service applies its own approval and rights safeguards.
 */
async function retrieveKnowledge(context) {
  const search = buildKnowledgeQuery(context);

  if (!search.query) {
    return {
      status: "skipped",
      evidence: [],
      evidenceCount: 0,
      candidateCount: 0,
      withheldCandidates: [],
      message:
        "No agricultural observation details were available for knowledge retrieval.",
    };
  }

  try {
    return await getKnowledgeForReasoning(
      search.query,
      {
        crop: search.crop,
        category: search.category,
        limit: 5,
      }
    );
  } catch (error) {
    console.error(
      "AgriMama knowledge retrieval failed:",
      error.message
    );

    return {
      status: "unavailable",
      evidence: [],
      evidenceCount: 0,
      candidateCount: 0,
      withheldCandidates: [],
      message:
        "Knowledge retrieval was unavailable. Existing decision rules will continue.",
    };
  }
}


/**
 * Find the crop-health observation using the same selection
 * behaviour as the cropHealth decision rule.
 */
function getCropHealthObservation(context) {
  const triggeringObservation =
    context.triggeringObservation;

  if (triggeringObservation) {
    return (
      triggeringObservation.category
        ?.toLowerCase()
        .trim() === "crop_health"
        ? triggeringObservation
        : null
    );
  }

  return (
    context.observations?.find(
      (observation) =>
        observation.category
          ?.toLowerCase()
          .trim() === "crop_health"
    ) || null
  );
}


/**
 * Retrieve local CSV knowledge candidates for crop-health observations.
 *
 * Candidate matching is not diagnosis and does not grant permission
 * to use draft or rights-unverified records in farmer advice.
 */
async function retrieveObservationKnowledge(context) {
  const observation = getCropHealthObservation(context);

  if (!observation) {
    return {
      status: "skipped",
      crop: null,
      candidateCount: 0,
      symptomCandidateCount: 0,
      clarificationCandidateCount: 0,
      eligibleEvidenceCount: 0,
      farmerRecommendationEligibleCount: 0,
      ambiguous: false,
      symptomCandidates: [],
      clarificationCandidates: [],
      suggestedQuestions: [],
      candidates: [],
    };
  }

  try {
    return await matchKnowledgeToObservation(
      observation,
      context.cropCycle,
      {
        limit: 5,
      }
    );
  } catch (error) {
    console.error(
      "AgriMama observation knowledge matching failed:",
      error.message
    );

    return {
      status: "unavailable",
      crop: context.cropCycle?.crop || null,
      candidateCount: 0,
      symptomCandidateCount: 0,
      clarificationCandidateCount: 0,
      eligibleEvidenceCount: 0,
      farmerRecommendationEligibleCount: 0,
      ambiguous: false,
      symptomCandidates: [],
      clarificationCandidates: [],
      suggestedQuestions: [],
      candidates: [],
    };
  }
}


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
    throw new Error(
      "Decision context could not be built."
    );
  }

  if (!context.farmer) {
    throw new Error(
      "Decision context is missing farmer information."
    );
  }

  if (!context.farm) {
    throw new Error(
      "Decision context is missing farm information."
    );
  }

  if (!context.cropCycle) {
    throw new Error(
      "Decision context is missing crop cycle information."
    );
  }

  // 2. Retrieve approved evidence from the AI Sandbox.
  const knowledgeResult = await retrieveKnowledge(context);

  context.knowledgeEvidence =
    knowledgeResult.evidence || [];

  // 3. Retrieve local CSV candidates for crop-health observations.
  const observationKnowledgeResult =
    await retrieveObservationKnowledge(context);

  context.knowledgeMatch =
    observationKnowledgeResult;

  console.log(
    "\n========== AGRIMAMA DECISION DEBUG =========="
  );

  console.log("Triggering observation:", {
    id: context.triggeringObservation?.id,
    category: context.triggeringObservation?.category,
  });

  console.log("AI Sandbox knowledge retrieval:", {
    status: knowledgeResult.status,
    candidates: knowledgeResult.candidateCount,
    eligibleEvidence: knowledgeResult.evidenceCount,
  });

  console.log("Local observation knowledge matching:", {
    status: observationKnowledgeResult.status,
    candidates: observationKnowledgeResult.candidateCount,
    symptomCandidates:
      observationKnowledgeResult.symptomCandidateCount,
    clarificationCandidates:
      observationKnowledgeResult.clarificationCandidateCount,
    ambiguous: observationKnowledgeResult.ambiguous,
    eligibleEvidence:
      observationKnowledgeResult.eligibleEvidenceCount,
    farmerRecommendationEligible:
      observationKnowledgeResult.farmerRecommendationEligibleCount,
  });

  console.log(
    "Suggested clarification questions:",
    observationKnowledgeResult.suggestedQuestions
  );

  console.log(
    "Forecast availability:",
    context.weatherForecast?.available
  );

  console.log(
    "Forecast sources:",
    JSON.stringify(
      context.weatherForecast?.sources,
      null,
      2
    )
  );

  // 4. Evaluate applicable rules.
  // The crop-health rule can now access context.knowledgeMatch.
  // Existing rule priorities and selection remain unchanged.
  const matchedRules = evaluateRules(context);

  console.log(
    "Matched rules:",
    matchedRules.map((rule) => ({
      name: rule.name,
      priority: rule.priority,
      actionCode: rule.decision?.actionCode,
    }))
  );

  console.log(
    "=============================================\n"
  );

  // 5. Select one primary next action.
  let decision = selectPrimaryDecision(matchedRules);

  // 6. Conservative fallback if no rule matches.
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

  // 7. Persist the recommendation, including metadata.
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
      decision.actionCode ||
      "PROVIDE_MORE_INFORMATION",

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

      // Preserve metadata generated by cropHealth.js
      // and add the AI Sandbox and local matcher results.
      knowledgeContext: {
        ...(decision.metadata?.knowledgeContext || {}),

        aiSandbox: {
          status: knowledgeResult.status,

          candidateCount:
            knowledgeResult.candidateCount || 0,

          evidenceCount:
            knowledgeResult.evidenceCount || 0,

          withheldCandidateCount:
            knowledgeResult.withheldCandidates?.length || 0,

          evidenceRecordIds:
            knowledgeResult.evidence?.map(
              (item) => item.recordId
            ) || [],
        },

        observationMatcher: {
          status: observationKnowledgeResult.status,

          candidateCount:
            observationKnowledgeResult.candidateCount || 0,

          symptomCandidateCount:
            observationKnowledgeResult.symptomCandidateCount || 0,

          clarificationCandidateCount:
            observationKnowledgeResult.clarificationCandidateCount || 0,

          ambiguous:
            observationKnowledgeResult.ambiguous === true,

          eligibleEvidenceCount:
            observationKnowledgeResult.eligibleEvidenceCount || 0,

          farmerRecommendationEligibleCount:
            observationKnowledgeResult.farmerRecommendationEligibleCount || 0,

          symptomCandidateIds:
            observationKnowledgeResult.symptomCandidates?.map(
              (item) => item.recordId
            ) || [],

          clarificationCandidateIds:
            observationKnowledgeResult.clarificationCandidates?.map(
              (item) => item.recordId
            ) || [],

          suggestedQuestions:
            observationKnowledgeResult.suggestedQuestions || [],
        },
      },

      weatherContext: {
        stationMeasurementCount:
          context.weather?.length || 0,

        forecastAvailable:
          context.weatherForecast?.available === true,

        forecastSource:
          context.weatherForecast?.sources?.[0]?.source || null,
      },
    },
  });

  return createdRecommendation;
}
