
import "dotenv/config";

import {
  getValidatedKnowledge,
  getKnowledgeById,
  searchKnowledgeByCrop,
  searchKnowledgeByCategory,
  getApprovedKnowledge,
  getKnowledgeForReasoning,
} from "./src/services/knowledge/knowledgeService.js";

async function runTests() {
  console.log("\n=== AgriMama Knowledge Service Test ===");

  // 1. Load and validate knowledge
  const knowledge = await getValidatedKnowledge();

  console.log("\n1. KNOWLEDGE SUMMARY");
  console.table({
    datasets: knowledge.datasetCount,
    records: knowledge.totalRecords,
    structurallyValid: knowledge.validRecords,
    approved: knowledge.approvedRecords,
    restricted: knowledge.restrictedRecords,
  });

  // 2. Retrieve exact record
  console.log("\n2. RECORD LOOKUP");

  const record = await getKnowledgeById("MAIZE_PD_014");

  console.log({
    recordId: record?.recordId,
    crop: record?.crop,
    problemName: record?.problemName,
    approvalStatus: record?.knowledgeStatus.approvalStatus,
    rightsStatus: record?.knowledgeStatus.rightsStatus,
  });

  // 3. Search by crop
  console.log("\n3. MAIZE SEARCH");

  const maizeRecords = await searchKnowledgeByCrop("Maize");

  console.log("Maize records found:", maizeRecords.length);

  console.table(
    maizeRecords.slice(0, 5).map((item) => ({
      recordId: item.recordId,
      crop: item.crop,
      problemName: item.problemName ?? item.varietyName ?? "",
      approval: item.knowledgeStatus.approvalStatus,
      rights: item.knowledgeStatus.rightsStatus,
    }))
  );

  // 4. Search by category
  console.log("\n4. CATEGORY SEARCH");

  const diseaseRecords = await searchKnowledgeByCategory("Disease");

  console.log("Disease records found:", diseaseRecords.length);

  // 5. Approved knowledge
  console.log("\n5. FARMER-RECOMMENDATION ELIGIBLE KNOWLEDGE");

  const approved = await getApprovedKnowledge();

  console.log("Approved records available:", approved.length);

  // 6. Semantic retrieval and eligibility check
  console.log("\n6. AI SANDBOX REASONING RETRIEVAL");

  const reasoning = await getKnowledgeForReasoning(
    "What causes maize leaves to turn yellow, and what should farmers investigate?",
    { crop: "Maize", limit: 5 }
  );

  console.log({
    status: reasoning.status,
    candidates: reasoning.candidateCount,
    eligibleEvidence: reasoning.evidenceCount,
    withheld: reasoning.withheldCandidates.length,
    message: reasoning.message,
  });

  console.log("\nKnowledge service tests completed.");
}

runTests().catch((error) => {
  console.error("\nKNOWLEDGE SERVICE TEST FAILED");
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
