
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

const DATA_DIR = path.resolve(
  process.cwd(),
  "data",
  "agri-knowledge"
);

/**
 * Convert CSV headers into consistent camelCase keys.
 *
 * Examples:
 * record_id       -> recordId
 * Record ID       -> recordId
 * source_url      -> sourceUrl
 * Source URL      -> sourceUrl
 */
function normalizeHeader(header) {
  const words = header
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());

  return words
    .map((word, index) =>
      index === 0
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join("");
}

/**
 * Identify files that must not be loaded.
 *
 * Restricted KALRO material must remain excluded.
 */
function isRestrictedFile(filename) {
  return /kalro.*restricted|restricted.*review.only/i.test(
    filename
  );
}

/**
 * Load and parse one agricultural CSV file.
 */
export async function loadKnowledgeFile(filename) {
  if (!filename || typeof filename !== "string") {
    throw new Error("A valid knowledge filename is required.");
  }

  if (path.extname(filename).toLowerCase() !== ".csv") {
    throw new Error(`Unsupported knowledge file: ${filename}`);
  }

  if (path.basename(filename) !== filename) {
    throw new Error("Invalid knowledge filename.");
  }

  if (isRestrictedFile(filename)) {
    throw new Error(
      `Restricted agricultural material cannot be loaded: ${filename}`
    );
  }

  const filePath = path.join(DATA_DIR, filename);

  let content;

  try {
    content = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`Knowledge file not found: ${filename}`);
    }

    throw error;
  }

  let records;

  try {
    records = parse(content, {
      bom: true,
      columns: (headers) =>
        headers.map(normalizeHeader),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false
    });
  } catch (error) {
    throw new Error(
      `Failed to parse ${filename}: ${error.message}`
    );
  }

  // Remove completely empty records.
  records = records.filter((record) =>
    Object.values(record).some(
      (value) => value !== null && value !== undefined && value !== ""
    )
  );

  return {
    sourceFile: filename,
    recordCount: records.length,
    records
  };
}

/**
 * Load all supported agricultural CSV files.
 */
export async function loadAllKnowledge() {
  let entries;

  try {
    entries = await fs.readdir(DATA_DIR, {
      withFileTypes: true
    });
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        `Agricultural knowledge directory not found: ${DATA_DIR}`
      );
    }

    throw error;
  }

  const filenames = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter(
      (filename) =>
        path.extname(filename).toLowerCase() === ".csv"
    )
    .filter((filename) => !isRestrictedFile(filename))
    .sort();

  const datasets = [];

  for (const filename of filenames) {
    const dataset = await loadKnowledgeFile(filename);

    datasets.push(dataset);
  }

  return {
    datasetCount: datasets.length,
    totalRecords: datasets.reduce(
      (total, dataset) => total + dataset.recordCount,
      0
    ),
    datasets
  };
}
