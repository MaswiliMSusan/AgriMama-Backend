
import {
  matchKnowledgeToObservation
} from "./src/services/knowledge/knowledgeMatcher.js";

const testCases = [
  {
    name: "Fall armyworm - translucent leaf damage",
    observation: {
      description:
        "My maize leaves have translucent scratch marks and small caterpillars."
    },
    cropCycle: {
      crop: "Maize",
      currentStage: "Vegetative"
    }
  },
  {
    name: "Fall armyworm - ragged holes",
    observation: {
      description:
        "There are ragged holes in my maize leaves and droppings inside the whorl."
    },
    cropCycle: {
      crop: "Maize",
      currentStage: "Vegetative"
    }
  },
  {
    name: "Possible stem borer symptoms",
    observation: {
      description:
        "The central leaves of my maize plants are drying and failing to emerge."
    },
    cropCycle: {
      crop: "Maize",
      currentStage: "Young plants"
    }
  },
  {
    name: "Unrelated observation",
    observation: {
      description:
        "My maize is growing well and I have no visible problems."
    },
    cropCycle: {
      crop: "Maize",
      currentStage: "Vegetative"
    }
  }
];

for (const testCase of testCases) {
  const result = await matchKnowledgeToObservation(
    testCase.observation,
    testCase.cropCycle
  );

  console.log(`\n=== ${testCase.name} ===`);
  console.log({
    status: result.status,
    candidateCount: result.candidateCount,
    eligibleEvidenceCount: result.eligibleEvidenceCount
  });

  console.table(
    result.candidates.map((candidate) => ({
      recordId: candidate.recordId,
      problemName: candidate.problemName,
      score: candidate.score,
      approval: candidate.approvalStatus,
      rights: candidate.rightsStatus
    }))
  );
}
