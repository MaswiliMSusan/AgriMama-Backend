
import "dotenv/config";
import { ingestAgriMamaDocument } from
  "../src/services/ai/knowledgeIngest.js";

const testDocument = `
AgriMama ingestion test.
Unique test phrase: maize rainfall retrieval check.
This is a technical test document, not farmer-facing agricultural advice.
`;

try {
  console.log("Testing AgriMama knowledge ingestion...");

  const result = await ingestAgriMamaDocument({
    filename: "agrimama-ingestion-test.txt",
    content: testDocument,
    contentType: "text/plain",
  });

  console.log("INGESTION RESPONSE:");
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error("INGESTION TEST FAILED:");
  console.error(error.message);
}
