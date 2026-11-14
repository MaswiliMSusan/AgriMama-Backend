const IDENTIFIER_FIELDS = ["recordId", "sourceId"];

const SOURCE_FIELDS = [
  "sourceUrl",
  "sourceLink",
  "source",
  "sourceBasis",
  "sourceOrganisation",
  "sourceOrganization",
  "publisher"
];

const APPROVAL_FIELDS = [
  "validationStatus",
  "evidenceReviewStatus",
  "reviewStatus"
];

const RIGHTS_FIELDS = [
  "rightsStatus",
  "rightsAndReuseStatus",
  "licenceReuseNotes",
  "licenceAndReuseNotes"
];

function firstValue(record, fields) {
  for (const field of fields) {
    const value = record[field];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim()
    ) {
      return String(value).trim();
    }
  }

  return null;
}

function combinedValue(record, fields) {
  return fields
    .map((field) => record[field])
    .filter(
      (value) =>
        value !== undefined &&
        value !== null &&
        String(value).trim()
    )
    .map(String)
    .join(" | ");
}

function classifyApproval(record) {
  const value = combinedValue(record, APPROVAL_FIELDS).toLowerCase();

  if (!value) return "unverified";

  if (
    /\bnot approved\b|\bnot validated\b|\bdraft\b|\bpending\b|\bawaiting\b|\bexpert review\b|\breview required\b|\bunverified\b|\bverify\b/.test(value)
  ) {
    return "draft";
  }

  if (/\bapproved\b|\bvalidated\b/.test(value)) {
    return "approved";
  }

  return "unverified";
}

function classifyRights(record, sourceFile) {
  const rights = combinedValue(record, RIGHTS_FIELDS).toLowerCase();
  const source = combinedValue(record, SOURCE_FIELDS).toLowerCase();

  const combined = `${rights} ${source} ${sourceFile}`.toLowerCase();

  if (
    /kalro/.test(combined) &&
    /restricted|all rights reserved|written permission|permission required|review only/.test(combined)
  ) {
    return "restricted";
  }

  if (
    /restricted|do not redistribute|do not ingest|prohibited|not permitted/.test(rights)
  ) {
    return "restricted";
  }

  if (
    sourceFile === "sweetpotato_knowledge_cip_cc_by_4.csv" ||
    /creativecommons\.org\/licenses\/by\/4\.0/.test(combined)
  ) {
    return "review_required";
  }

  if (
    /review|permission|third.party|check source|terms/.test(rights)
  ) {
    return "review_required";
  }

  return "unknown";
}

function isSourceRegister(filename) {
  return filename === "source_register_and_attribution.csv";
}

function validateRecord(record, seenIds, sourceFile) {
  const issues = [];
  const warnings = [];

  const recordId = firstValue(record, IDENTIFIER_FIELDS);

  // Structural validation: identifiers and data structure only.
  if (!recordId) {
    issues.push("Missing record identifier.");
  } else {
    const key = recordId.toLowerCase();

    if (seenIds.has(key)) {
      issues.push(`Duplicate record identifier: ${recordId}`);
    } else {
      seenIds.add(key);
    }
  }

  const sourceUrl = firstValue(record, [
    "sourceUrl",
    "sourceLink"
  ]);

  if (sourceUrl) {
    try {
      const url = new URL(sourceUrl);

      if (!["http:", "https:"].includes(url.protocol)) {
        warnings.push("Source URL must use HTTP or HTTPS.");
      }
    } catch {
      warnings.push("Source URL is malformed.");
    }
  } else {
    warnings.push("No source URL recorded.");
  }

  // Agricultural approval and reuse rights are separate checks.
  const approvalStatus = classifyApproval(record);
  const rightsStatus = classifyRights(record, sourceFile);

  if (approvalStatus !== "approved") {
    warnings.push(
      "Agricultural approval has not been established."
    );
  }

  if (rightsStatus === "review_required") {
    warnings.push("Source reuse requires further review.");
  }

  if (rightsStatus === "unknown") {
    warnings.push("Source reuse permissions are unknown.");
  }

  if (rightsStatus === "restricted") {
    warnings.push(
      "Source material is restricted and cannot be used."
    );
  }

  const structurallyValid = issues.length === 0;

  const canUseAsInternalEvidence =
    structurallyValid &&
    rightsStatus === "cleared";

  const canSupportFarmerRecommendation =
    structurallyValid &&
    approvalStatus === "approved" &&
    rightsStatus === "cleared";

  return {
    record,
    knowledgeStatus: {
      recordId,
      approvalStatus,
      rightsStatus,
      structurallyValid,
      canUseAsInternalEvidence,
      canSupportFarmerRecommendation,
      issues,
      warnings
    }
  };
}

export function validateKnowledgeDatasets(loaded) {
  if (!loaded || !Array.isArray(loaded.datasets)) {
    throw new Error(
      "Expected a datasets array from knowledgeLoader."
    );
  }

  const datasets = [];

  const summary = {
    datasetCount: 0,
    totalRecords: 0,
    validRecords: 0,
    recordsWithIssues: 0,
    recordsWithWarnings: 0,

    approvedRecords: 0,
    draftRecords: 0,
    unverifiedRecords: 0,

    rightsClearedRecords: 0,
    rightsReviewRequiredRecords: 0,
    rightsUnknownRecords: 0,
    restrictedRecords: 0,

    recordsWithRightsRestrictions: 0,

    internalEvidenceEligible: 0,
    farmerRecommendationEligible: 0,

    sourceRegisterRecords: 0
  };

  for (const dataset of loaded.datasets) {
    if (!Array.isArray(dataset.records)) {
      throw new Error(
        `Invalid records in ${dataset.sourceFile}.`
      );
    }

    // Source register is metadata, not agricultural evidence.
    if (isSourceRegister(dataset.sourceFile)) {
      summary.sourceRegisterRecords += dataset.records.length;

      datasets.push({
        sourceFile: dataset.sourceFile,
        recordCount: dataset.recordCount,
        datasetType: "source_metadata",
        records: dataset.records,
        summary: {
          totalRecords: dataset.records.length
        }
      });

      continue;
    }

    const seenIds = new Set();

    const records = dataset.records.map((record) =>
      validateRecord(record, seenIds, dataset.sourceFile)
    );

    datasets.push({
      sourceFile: dataset.sourceFile,
      recordCount: dataset.recordCount,
      datasetType: "agricultural_knowledge",
      records,
      summary: {
        totalRecords: records.length,
        recordsWithIssues: records.filter(
          (item) => item.knowledgeStatus.issues.length
        ).length,
        recordsWithWarnings: records.filter(
          (item) => item.knowledgeStatus.warnings.length
        ).length
      }
    });

    for (const item of records) {
      const status = item.knowledgeStatus;

      summary.totalRecords++;

      if (status.structurallyValid) {
        summary.validRecords++;
      } else {
        summary.recordsWithIssues++;
      }

      if (status.warnings.length) {
        summary.recordsWithWarnings++;
      }

      summary[`${status.approvalStatus}Records`]++;

      if (status.rightsStatus === "cleared") {
        summary.rightsClearedRecords++;
      } else if (status.rightsStatus === "review_required") {
        summary.rightsReviewRequiredRecords++;
      } else if (status.rightsStatus === "unknown") {
        summary.rightsUnknownRecords++;
      } else if (status.rightsStatus === "restricted") {
        summary.restrictedRecords++;
        summary.recordsWithRightsRestrictions++;
      }

      if (status.canUseAsInternalEvidence) {
        summary.internalEvidenceEligible++;
      }

      if (status.canSupportFarmerRecommendation) {
        summary.farmerRecommendationEligible++;
      }
    }
  }

  summary.datasetCount = datasets.length;

  return {
    ...summary,
    datasets
  };
}