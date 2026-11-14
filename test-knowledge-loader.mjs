
import {
  loadAllKnowledge,
  loadKnowledgeFile
} from "./src/services/knowledge/knowledgeLoader.js";

async function testKnowledgeLoader() {
  console.log("\n=== AgriMama Knowledge Loader Test ===\n");

  const result = await loadAllKnowledge();

  console.log("Datasets loaded:", result.datasetCount);
  console.log("Total records:", result.totalRecords);

  for (const dataset of result.datasets) {
    console.log(
      `${dataset.sourceFile}: ${dataset.recordCount} records`
    );
  }

  console.log("\n=== Testing Exact Record Loading ===\n");

  const pestDataset = await loadKnowledgeFile(
    "maize_pest_disease_identification_draft.csv"
  );

  const record = pestDataset.records.find(
    (item) => item.recordId === "MAIZE_PD_014"
  );

  console.log("MAIZE_PD_014:");
  console.dir(record, { depth: null });

  if (!record) {
    throw new Error("MAIZE_PD_014 was not found.");
  }

  console.log("\nKnowledge loader test completed.");
}

testKnowledgeLoader().catch((error) => {
  console.error("TEST FAILED:", error);
  process.exitCode = 1;
});
