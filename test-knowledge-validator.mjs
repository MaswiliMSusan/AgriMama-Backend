
import {
  loadAllKnowledge
} from "./src/services/knowledge/knowledgeLoader.js";

import {
  validateKnowledgeDatasets
} from "./src/services/knowledge/knowledgeValidator.js";

async function testKnowledgeValidator() {
  console.log("\n=== AgriMama Knowledge Validator Test ===\n");

  const loaded = await loadAllKnowledge();

  const validated = validateKnowledgeDatasets(loaded);

  console.log("VALIDATION SUMMARY");

console.table({
  datasets: validated.datasetCount,
  agriculturalRecords: validated.totalRecords,
  sourceRegisterRecords: validated.sourceRegisterRecords,
  structurallyValid: validated.validRecords,
  recordsWithIssues: validated.recordsWithIssues,
  approved: validated.approvedRecords,
  draft: validated.draftRecords,
  unverified: validated.unverifiedRecords,
  rightsReviewRequired: validated.rightsReviewRequiredRecords,
  rightsUnknown: validated.rightsUnknownRecords,
  restricted: validated.restrictedRecords,
  recordsWithRightsRestrictions:
    validated.recordsWithRightsRestrictions,
  internalEvidenceEligible: validated.internalEvidenceEligible,
  farmerRecommendationEligible:
    validated.farmerRecommendationEligible
});

  const pestDataset = validated.datasets.find(
    (dataset) =>
      dataset.sourceFile ===
      "maize_pest_disease_identification_draft.csv"
  );

  const record = pestDataset?.records.find(
    (item) =>
      item.knowledgeStatus.recordId === "MAIZE_PD_014"
  );

  console.log("\nMAIZE_PD_014 VALIDATION RESULT:");

  console.dir(record, { depth: null });

  if (!record) {
    throw new Error("MAIZE_PD_014 was not found.");
  }

  if (
    record.knowledgeStatus.approvalStatus !== "draft"
  ) {
    throw new Error(
      "Expected MAIZE_PD_014 to remain a draft."
    );
  }

  if (
    record.knowledgeStatus.canSupportFarmerRecommendation
  ) {
    throw new Error(
      "A draft record must not support farmer-facing recommendations."
    );
  }

  console.log("\nKnowledge validator test completed.");
}

testKnowledgeValidator().catch((error) => {
  console.error("TEST FAILED:", error);
  process.exitCode = 1;
});
