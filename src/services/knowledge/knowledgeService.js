
import { loadAllKnowledge } from "./knowledgeLoader.js";
import { validateKnowledgeDatasets } from "./knowledgeValidator.js";
import { searchAgriMamaKnowledge } from "../ai/knowledgeSearch.js";

let knowledgeCache = null;

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function getSearchableText(record) {
  return Object.values(record)
    .filter((value) => value !== null && value !== undefined)
    .map(String)
    .join(" ")
    .toLowerCase();
}

function getAgriculturalRecords(validated) {
  return validated.datasets
    .filter((dataset) => dataset.datasetType === "agricultural_knowledge")
    .flatMap((dataset) =>
      dataset.records.map((item) => ({
        ...item.record,
        knowledgeStatus: item.knowledgeStatus,
        sourceFile: dataset.sourceFile,
      }))
    );
}

function matchesQuery(record, query) {
  if (!query) return true;

  return getSearchableText(record).includes(normalize(query));
}

function applyLimit(records, limit = 20) {
  const safeLimit = Math.min(
    100,
    Math.max(1, Number(limit) || 20)
  );

  return records.slice(0, safeLimit);
}

/**
 * Load and validate local agricultural knowledge.
 * Results are cached until refreshKnowledge() is called.
 */
export async function getValidatedKnowledge({ refresh = false } = {}) {
  if (knowledgeCache && !refresh) {
    return knowledgeCache;
  }

  const loaded = await loadAllKnowledge();
  const validated = validateKnowledgeDatasets(loaded);

  knowledgeCache = {
    ...validated,
    records: getAgriculturalRecords(validated),
  };

  return knowledgeCache;
}

/**
 * Clear the in-memory knowledge cache.
 */
export function refreshKnowledge() {
  knowledgeCache = null;
}

/**
 * Retrieve a local record using its exact record ID.
 * Returns the record and its validation status.
 */
export async function getKnowledgeById(recordId) {
  if (!recordId || typeof recordId !== "string") {
    throw new Error("A valid knowledge record ID is required.");
  }

  const knowledge = await getValidatedKnowledge();

  return (
    knowledge.records.find(
      (record) =>
        normalize(record.recordId) === normalize(recordId)
    ) ?? null
  );
}

/**
 * Search local structured records by crop.
 * This includes drafts and unverified records for inspection.
 * Check knowledgeStatus before using a result as evidence.
 */
export async function searchKnowledgeByCrop(
  crop,
  query = "",
  options = {}
) {
  if (!crop || typeof crop !== "string") {
    throw new Error("A crop name is required.");
  }

  const knowledge = await getValidatedKnowledge();

  const results = knowledge.records.filter((record) => {
    const cropMatches =
      normalize(record.crop) === normalize(crop);

    return cropMatches && matchesQuery(record, query);
  });

  return applyLimit(results, options.limit);
}

/**
 * Search local records by category.
 * Supports common dataset field names.
 */
export async function searchKnowledgeByCategory(
  category,
  query = "",
  options = {}
) {
  if (!category || typeof category !== "string") {
    throw new Error("A knowledge category is required.");
  }

  const knowledge = await getValidatedKnowledge();

  const categoryFields = [
    "category",
    "problemType",
    "knowledgeCategory",
    "topic",
    "issueType",
    "type",
  ];

  const results = knowledge.records.filter((record) => {
    const categoryMatches = categoryFields.some(
      (field) =>
        normalize(record[field]) === normalize(category)
    );

    return categoryMatches && matchesQuery(record, query);
  });

  return applyLimit(results, options.limit);
}

/**
 * Return records approved for farmer-facing recommendations.
 * Both agricultural approval and reuse clearance are required.
 */
export async function getApprovedKnowledge(options = {}) {
  const knowledge = await getValidatedKnowledge();

  const approved = knowledge.records.filter(
    (record) =>
      record.knowledgeStatus.canSupportFarmerRecommendation
  );

  return applyLimit(approved, options.limit);
}

/**
 * Search the AI Sandbox, then verify any candidate against
 * locally validated records before allowing it into reasoning.
 *
 * A semantic search result is not automatically approved evidence.
 */
export async function getKnowledgeForReasoning(
  query,
  context = {}
) {
  if (typeof query !== "string" || !query.trim()) {
    throw new Error("A reasoning query is required.");
  }

  const knowledge = await getValidatedKnowledge();

  const searchQuery = [
    context.crop,
    context.category,
    query,
  ]
    .filter(Boolean)
    .join(" ");

  const searchResponse = await searchAgriMamaKnowledge(
    searchQuery,
    context.limit ?? 5
  );

  const searchResults =
    searchResponse?.data ??
    searchResponse?.results ??
    searchResponse?.matches ??
    [];

  if (!Array.isArray(searchResults)) {
    return {
      query,
      evidence: [],
      withheldCandidates: [],
      evidenceCount: 0,
      candidateCount: 0,
      status: "unavailable",
      message: "The knowledge search returned an unexpected response format.",
    };
  }

  const eligibleRecords = knowledge.records.filter(
    (record) =>
      record.knowledgeStatus.canSupportFarmerRecommendation
  );

  const evidence = [];
  const withheldCandidates = [];
  const matchedRecordIds = new Set();

  for (const result of searchResults) {
    const content = Array.isArray(result?.content)
      ? result.content
          .map((item) =>
            typeof item === "string" ? item : item?.text ?? ""
          )
          .join(" ")
      : result?.text ?? "";

    const filename = result?.filename ?? null;

    // Match exact local record IDs appearing in the retrieved text.
    const matchedRecords = eligibleRecords.filter((record) => {
      const id = String(record.recordId ?? "");

      if (!id) return false;

      const escapedId = id.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      return new RegExp(
        `(^|[^a-zA-Z0-9_-])${escapedId}([^a-zA-Z0-9_-]|$)`,
        "i"
      ).test(content);
    });

    if (matchedRecords.length === 0) {
      withheldCandidates.push({
        filename,
        score: result?.score ?? null,
        reason:
          "No matching locally approved and rights-cleared record was identified.",
      });

      continue;
    }

    for (const record of matchedRecords) {
      if (matchedRecordIds.has(record.recordId)) continue;

      matchedRecordIds.add(record.recordId);

      // Use the validated local record, not the raw vector-store chunk.
      evidence.push({
        ...record,
        retrievalScore: result?.score ?? null,
      });
    }
  }

  return {
    query,
    evidence,
    withheldCandidates,
    evidenceCount: evidence.length,
    candidateCount: searchResults.length,
    status: evidence.length > 0 ? "evidence_found" : "no_eligible_evidence",
    message:
      evidence.length > 0
        ? "Approved, rights-cleared local records were matched."
        : "Search returned no evidence eligible for farmer recommendations.",
  };
}
