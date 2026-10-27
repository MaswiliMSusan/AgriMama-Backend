
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { ingestAgriMamaDocument } from
  "../src/services/ai/knowledgeIngest.js";

const DATA_DIR = path.resolve("data/agri-knowledge");
const MANIFEST_PATH = path.join(
  DATA_DIR,
  "ingested-manifest.json"
);

const SUPPORTED_TYPES = {
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".md": "text/markdown",
};

function isRestricted(filename) {
  return /kalro.*restricted|restricted.*review.only/i.test(filename);
}

async function loadManifest() {
  try {
    return JSON.parse(
      await fs.readFile(MANIFEST_PATH, "utf8")
    );
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

async function main() {
  const entries = await fs.readdir(DATA_DIR, {
    withFileTypes: true,
  });

  const manifest = await loadManifest();

  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => SUPPORTED_TYPES[path.extname(name).toLowerCase()])
    .filter((name) => name !== path.basename(MANIFEST_PATH))
    .sort();

  if (files.length === 0) {
    throw new Error(
      `No supported files found in ${DATA_DIR}`
    );
  }

  console.log(`Found ${files.length} supported files.`);

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const filename of files) {
    if (isRestricted(filename)) {
      console.log(`\nSKIPPED — restricted material: ${filename}`);
      skipped++;
      continue;
    }

    if (manifest[filename]?.status === "completed") {
      console.log(`\nSKIPPED — already ingested: ${filename}`);
      skipped++;
      continue;
    }

    console.log(`\nUploading: ${filename}`);

    try {
      const content = await fs.readFile(
        path.join(DATA_DIR, filename),
        "utf8"
      );

      const result = await ingestAgriMamaDocument({
        filename,
        content,
        contentType: SUPPORTED_TYPES[
          path.extname(filename).toLowerCase()
        ],
      });

      

if (result.status !== "completed") {
  console.error("INGESTION API RESPONSE:");
  console.error(JSON.stringify(result, null, 2));

  manifest[filename] = {
    status: result.status ?? "unknown",
    ingestionId: result.id ?? null,
    vectorStoreId: result.vector_store_id ?? null,
    fileId: result.file_id ?? null,
    error: result.error ?? result.message ?? null,
    checkedAt: new Date().toISOString(),
  };

  await fs.writeFile(
    MANIFEST_PATH,
    JSON.stringify(manifest, null, 2),
    "utf8"
  );

  throw new Error(
    `Ingestion status was ${result.status ?? "missing"}. See API response above.`
  );
}


      manifest[filename] = {
        status: result.status,
        ingestionId: result.id ?? null,
        vectorStoreId: result.vector_store_id ?? null,
        fileId: result.file_id ?? null,
        ingestedAt: new Date().toISOString(),
      };

      await fs.writeFile(
        MANIFEST_PATH,
        JSON.stringify(manifest, null, 2),
        "utf8"
      );

      console.log("INGESTION COMPLETED");
      console.log(`Vector store: ${result.vector_store_id}`);
      console.log(`File ID: ${result.file_id ?? "not returned"}`);
      succeeded++;
    } catch (error) {
      console.error(`FAILED: ${filename}`);
      console.error(error.message);
      failed++;
    }
  }

  console.log("\n========== BATCH SUMMARY ==========");
  console.log(`Completed this run: ${succeeded}`);
  console.log(`Failed this run:    ${failed}`);
  console.log(`Skipped this run:   ${skipped}`);
  console.log(`Manifest:           ${MANIFEST_PATH}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Batch ingestion could not start:");
  console.error(error.message);
  process.exitCode = 1;
});
