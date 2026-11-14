
import { loadAllKnowledge } from "./knowledgeLoader.js";
import { validateKnowledgeDatasets } from "./knowledgeValidator.js";

let validatedKnowledgeCache = null;

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this",
  "there", "their", "have", "has", "are", "was", "were",
  "can", "may", "might", "some", "several", "many",
  "plant", "plants", "crop", "crops", "affected",
  "show", "shows", "showing", "present", "visible",
  "small", "large", "young", "stage", "inside",
  "including", "look", "looks", "my", "is", "it",
  "a", "an", "of", "in", "on", "to", "by",
  "or", "but", "as", "at", "be", "been",
  "no", "not", "well", "good", "healthy",
  "i", "am", "does", "did", "its", "they",
  "which", "what", "when", "where", "how",
  "also", "very", "more", "most", "than",
  "then", "about", "after", "before"
]);

const HEALTHY_OBSERVATION_PATTERNS = [
  /\bno visible problems?\b/i,
  /\bno signs? of (?:damage|disease|pests?)\b/i,
  /\b(?:growing|looks?|appears?) (?:very )?(?:well|healthy|normally)\b/i,
  /\bno damage\b/i,
  /\bno symptoms\b/i
];

function normalizeText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value, excludedTokens = new Set()) {
  return new Set(
    normalizeText(value)
      .split(/\s+/)
      .map((word) => word.replace(/s$/, ""))
      .filter(
        (word) =>
          word.length > 2 &&
          !STOP_WORDS.has(word) &&
          !excludedTokens.has(word)
      )
  );
}

function getObservationText(observation = {}) {
  const fields = [
    "description",
    "notes",
    "message",
    "value",
    "symptoms",
    "details"
  ];

  return fields
    .map((field) => observation[field])
    .filter(
      (value) =>
        value !== null &&
        value !== undefined &&
        String(value).trim()
    )
    .join(" ");
}

function getCropName(cropCycle = {}) {
  const crop = cropCycle.crop;

  if (typeof crop === "string") {
    return crop;
  }

  if (crop && typeof crop === "object") {
    return crop.name || crop.cropName || "";
  }

  return cropCycle.cropName || cropCycle.cropType || "";
}

function getGrowthStage(cropCycle = {}) {
  return normalizeText(
    cropCycle.currentStage ||
    cropCycle.growthStage ||
    ""
  );
}

async function getValidatedKnowledge(refresh = false) {
  if (!validatedKnowledgeCache || refresh) {
    const loaded = await loadAllKnowledge();

    validatedKnowledgeCache =
      validateKnowledgeDatasets(loaded);
  }

  return validatedKnowledgeCache;
}

function getRecordTokens(record, excludedTokens) {
  return {
    symptoms: tokenize(
      record.visibleSymptoms || "",
      excludedTokens
    ),

    plantParts: tokenize(
      record.affectedPlantPart || "",
      excludedTokens
    ),

    followUps: tokenize(
      record.followUpQuestions || "",
      excludedTokens
    )
  };
}

function calculateIdf(
  token,
  documentFrequency,
  totalDocuments
) {
  const frequency =
    documentFrequency.get(token) || 0;

  return Math.log(
    1 +
    (totalDocuments - frequency + 0.5) /
    (frequency + 0.5)
  );
}

function buildDocumentFrequency(records, excludedTokens) {
  const frequency = new Map();

  for (const item of records) {
    const tokens = tokenize(
      item.record.visibleSymptoms || "",
      excludedTokens
    );

    for (const token of tokens) {
      frequency.set(
        token,
        (frequency.get(token) || 0) + 1
      );
    }
  }

  return frequency;
}

function calculateMatch(
  observationText,
  cropCycle,
  item,
  documentFrequency,
  totalDocuments
) {
  const record = item.record;

  const cropTokens = tokenize(getCropName(cropCycle));

  const observationTokens = tokenize(
    observationText,
    cropTokens
  );

  const recordTokens = getRecordTokens(
    record,
    cropTokens
  );

  const symptomMatches = [
    ...observationTokens
  ].filter((token) =>
    recordTokens.symptoms.has(token)
  );

  const plantPartMatches = [
    ...observationTokens
  ].filter((token) =>
    recordTokens.plantParts.has(token)
  );

  const followUpMatches = [
    ...observationTokens
  ].filter((token) =>
    recordTokens.followUps.has(token)
  );

  const symptomWeight = symptomMatches.reduce(
    (total, token) =>
      total +
      calculateIdf(
        token,
        documentFrequency,
        totalDocuments
      ),
    0
  );

  const plantPartWeight = plantPartMatches.reduce(
    (total, token) =>
      total +
      calculateIdf(
        token,
        documentFrequency,
        totalDocuments
      ),
    0
  );

  const followUpWeight = followUpMatches.reduce(
    (total, token) =>
      total +
      calculateIdf(
        token,
        documentFrequency,
        totalDocuments
      ),
    0
  );

  const farmerStage = getGrowthStage(cropCycle);

  const recordStage = normalizeText(
    record.growthStage || ""
  );

  const stageMatches =
    farmerStage &&
    recordStage &&
    (
      recordStage.includes(farmerStage) ||
      farmerStage.includes(recordStage)
    );

  const reasons = [];

  if (symptomMatches.length > 0) {
    reasons.push({
      field: "visibleSymptoms",
      matchedTerms: symptomMatches
    });
  }

  if (plantPartMatches.length > 0) {
    reasons.push({
      field: "affectedPlantPart",
      matchedTerms: plantPartMatches
    });
  }

  if (followUpMatches.length > 0) {
    reasons.push({
      field: "followUpQuestions",
      matchedTerms: followUpMatches
    });
  }

  if (stageMatches) {
    reasons.push({
      field: "growthStage",
      matchedTerms: [farmerStage]
    });
  }

  const symptomScore =
    symptomWeight * 3 + plantPartWeight;

  // Follow-up overlap is useful for clarification,
  // but does not independently establish a diagnosis.
  const clarificationScore = followUpWeight;

  const score =
    symptomScore +
    clarificationScore * 0.25 +
    (stageMatches ? 0.5 : 0);

  const matched =
    symptomMatches.length >= 2 ||
    (
      symptomMatches.length >= 1 &&
      plantPartMatches.length >= 1
    );

  const clarificationRelevant =
    followUpMatches.length >= 2;

  return {
    symptomScore: Number(symptomScore.toFixed(2)),

    clarificationScore: Number(
      clarificationScore.toFixed(2)
    ),

    score: Number(score.toFixed(2)),

    symptomMatches,
    plantPartMatches,
    followUpMatches,

    reasons,
    matched,
    clarificationRelevant
  };
}

/**
 * Match an observation against agricultural knowledge records.
 *
 * Returns separate symptom and clarification candidates.
 *
 * This function does not diagnose a crop problem.
 * It does not approve knowledge records or farmer advice.
 */
export async function matchKnowledgeToObservation(
  observation,
  cropCycle,
  options = {}
) {
  if (!observation || typeof observation !== "object") {
    throw new Error("A valid observation is required.");
  }

  if (!cropCycle || typeof cropCycle !== "object") {
    throw new Error("A valid crop cycle is required.");
  }

  const observationText =
    getObservationText(observation);

  if (!observationText.trim()) {
    return {
      status: "no_observation_text",
      crop: getCropName(cropCycle),
      candidateCount: 0,
      symptomCandidateCount: 0,
      clarificationCandidateCount: 0,
      eligibleEvidenceCount: 0,
      farmerRecommendationEligibleCount: 0,
      ambiguous: false,
      symptomCandidates: [],
      clarificationCandidates: [],
      suggestedQuestions: [],
      candidates: []
    };
  }

  const cropName = normalizeText(
    getCropName(cropCycle)
  );

  if (!cropName) {
    return {
      status: "crop_not_identified",
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
      candidates: []
    };
  }

  if (
    HEALTHY_OBSERVATION_PATTERNS.some(
      (pattern) => pattern.test(observationText)
    )
  ) {
    return {
      status: "no_symptoms_reported",
      crop: getCropName(cropCycle),
      candidateCount: 0,
      symptomCandidateCount: 0,
      clarificationCandidateCount: 0,
      eligibleEvidenceCount: 0,
      farmerRecommendationEligibleCount: 0,
      ambiguous: false,
      symptomCandidates: [],
      clarificationCandidates: [],
      suggestedQuestions: [],
      candidates: []
    };
  }

  const knowledge = await getValidatedKnowledge(
    options.refresh === true
  );

  const limit = Number.isInteger(options.limit)
    ? Math.max(1, options.limit)
    : 5;

  const cropRecords = [];

  for (const dataset of knowledge.datasets) {
    if (dataset.datasetType !== "agricultural_knowledge") {
      continue;
    }

    for (const item of dataset.records) {
      if (
        normalizeText(item.record.crop) === cropName
      ) {
        cropRecords.push({
          item,
          sourceFile: dataset.sourceFile
        });
      }
    }
  }

  const records = cropRecords.map(
    ({ item }) => item
  );

  const cropTokens = tokenize(getCropName(cropCycle));

  const documentFrequency = buildDocumentFrequency(
    records,
    cropTokens
  );

  const symptomCandidates = [];
  const clarificationCandidates = [];

  for (const { item, sourceFile } of cropRecords) {
    const record = item.record;

    const match = calculateMatch(
      observationText,
      cropCycle,
      item,
      documentFrequency,
      records.length
    );

    if (
      !match.matched &&
      !match.clarificationRelevant
    ) {
      continue;
    }

    const candidate = {
      recordId: item.knowledgeStatus.recordId,

      crop: record.crop || null,
      problemType: record.problemType || null,
      problemName: record.problemName || null,

      score: match.score,
      symptomScore: match.symptomScore,
      clarificationScore: match.clarificationScore,

      matchingReasons: match.reasons,

      symptomMatches: match.symptomMatches,
      plantPartMatches: match.plantPartMatches,
      followUpMatches: match.followUpMatches,

      growthStage: record.growthStage || null,
      visibleSymptoms: record.visibleSymptoms || null,
      affectedPlantPart:
        record.affectedPlantPart || null,

      followUpQuestions:
        record.followUpQuestions || null,

      recommendedObservation:
        record.recommendedObservation || null,

      escalationConditions:
        record.escalationConditions || null,

      approvalStatus:
        item.knowledgeStatus.approvalStatus,

      rightsStatus:
        item.knowledgeStatus.rightsStatus,

      canUseAsInternalEvidence:
        item.knowledgeStatus.canUseAsInternalEvidence,

      canSupportFarmerRecommendation:
        item.knowledgeStatus.canSupportFarmerRecommendation,

      sourceFile
    };

    if (match.matched) {
      symptomCandidates.push(candidate);
    }

    if (match.clarificationRelevant) {
      clarificationCandidates.push(candidate);
    }
  }

  const sortCandidates = (a, b) =>
    b.score - a.score;

  symptomCandidates.sort(sortCandidates);
  clarificationCandidates.sort(sortCandidates);

  const limitedSymptoms =
    symptomCandidates.slice(0, limit);

  const limitedClarifications =
    clarificationCandidates.slice(0, limit);

  // Merge both groups without duplicate records.
  const combined = new Map();

  for (const candidate of [
    ...limitedSymptoms,
    ...limitedClarifications
  ]) {
    combined.set(candidate.recordId, candidate);
  }

  const candidates = [...combined.values()];

  const suggestedQuestions = [
    ...new Set(
      limitedClarifications
        .map((candidate) => candidate.followUpQuestions)
        .filter(Boolean)
    )
  ];

  const eligibleEvidenceCount = candidates.filter(
    (candidate) =>
      candidate.canUseAsInternalEvidence
  ).length;

  const farmerRecommendationEligibleCount =
    candidates.filter(
      (candidate) =>
        candidate.canSupportFarmerRecommendation
    ).length;

  return {
    status: candidates.length
      ? "candidates_found"
      : "no_matching_candidates",

    crop: getCropName(cropCycle),

    candidateCount: candidates.length,

    symptomCandidateCount: limitedSymptoms.length,

    clarificationCandidateCount:
      limitedClarifications.length,

    ambiguous: limitedSymptoms.length > 1,

    eligibleEvidenceCount,

    farmerRecommendationEligibleCount,

    symptomCandidates: limitedSymptoms,

    clarificationCandidates: limitedClarifications,

    suggestedQuestions,

    // Retained for compatibility with existing consumers.
    candidates
  };
}

export function clearKnowledgeMatcherCache() {
  validatedKnowledgeCache = null;
}
