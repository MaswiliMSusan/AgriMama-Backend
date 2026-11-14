
function normalise(value) {
  return typeof value === "string" ? value.toLowerCase().trim() : "";
}

function getCropName(cropCycle) {
  const crop = cropCycle?.crop;

  if (typeof crop === "string") return crop.trim();

  return crop?.name || crop?.cropName || cropCycle?.cropName || "crop";
}

function buildInterimGuidance(observation, cropName) {
  const description = normalise([
    observation.description,
    observation.notes,
    observation.message,
    observation.value
  ].filter(Boolean).join(" "));

  const leafDamage =
    /\bleaf|leaves|whorl|hole|holes|eaten|chewed|ragged|yellow|spots|streaks\b/.test(description);

  if (
    cropName.toLowerCase().includes("maize") &&
    leafDamage
  ) {
    return {
      recommendation:
        `Your ${cropName} may be experiencing insect feeding or another form of leaf damage. The exact cause is not yet confirmed. For now:\n\n` +
        "1. Inspect several affected plants, not just one.\n" +
        "2. Check inside the centre of the maize leaves (the whorl) and underneath the leaves for insects, eggs or droppings.\n" +
        "3. Look for fresh feeding damage and check whether new leaves are also affected.\n" +
        "4. Take a clear photo of an affected leaf and, if possible, the centre of the plant.\n" +
        "5. Avoid applying pesticides until the problem has been better identified and an appropriate treatment has been established.",
      followUpQuestion:
        "Have you noticed small caterpillars or droppings inside the centre of the maize leaves?",
      nextSteps: [
        "Inspect several affected plants.",
        "Check the maize whorl and undersides of leaves.",
        "Look for insects, eggs and droppings.",
        "Photograph the damage and monitor whether it spreads."
      ],
      adviceType: "general_interim_guidance"
    };
  }

  if (leafDamage) {
    return {
      recommendation:
        `The leaves of your ${cropName} are showing signs of damage, but the cause is not yet confirmed. For now:\n\n` +
        "1. Inspect several affected plants and compare them with healthy plants.\n" +
        "2. Check both sides of the leaves for insects, eggs, spots or unusual growth.\n" +
        "3. Observe whether the damage is spreading to new leaves or nearby plants.\n" +
        "4. Take clear photos of the affected parts.\n" +
        "5. Avoid applying pesticides or other treatments until the cause is better understood.",
      followUpQuestion:
        "What does the damage look like: holes, yellow patches, spots, or leaves drying out?",
      nextSteps: [
        "Compare affected and healthy plants.",
        "Inspect both sides of the leaves.",
        "Record how the damage is changing.",
        "Take clear photos."
      ],
      adviceType: "general_interim_guidance"
    };
  }

  return {
    recommendation:
      `Let's investigate what is affecting your ${cropName}. For now:\n\n` +
      "1. Check several affected plants and compare them with healthy ones.\n" +
      "2. Identify which parts are affected: leaves, stems, roots, flowers or fruits.\n" +
      "3. Look for visible changes such as discolouration, wilting, insects or unusual growth.\n" +
      "4. Take clear photos and note when the problem started.\n" +
      "5. Avoid applying treatments until we have a better understanding of the problem.",
    followUpQuestion:
      "Which part of the plant is affected most, and what changes have you noticed?",
    nextSteps: [
      "Inspect several affected plants.",
      "Identify the affected plant parts.",
      "Record visible symptoms and when they started.",
      "Take clear photos."
    ],
    adviceType: "general_interim_guidance"
  };
}

export function evaluateCropHealth(context) {
  if (!context) {
    throw new Error("Decision context is required.");
  }

  const {
    farmer,
    farm,
    cropCycle,
    observations = [],
    weather = [],
    weatherForecast = null,
    triggeringObservation = null,
    knowledgeMatch = null
  } = context;

  if (!cropCycle) {
    throw new Error("Crop cycle is required.");
  }

  // 1. Prefer the observation that triggered this decision.
  const cropHealthObservation = triggeringObservation
    ? (
        normalise(triggeringObservation.category) === "crop_health"
          ? triggeringObservation
          : null
      )
    : (
        observations.find(
          (observation) =>
            normalise(observation.category) === "crop_health"
        ) || null
      );

  if (!cropHealthObservation) {
    return null;
  }

  // 2. Extract crop context.
  const cropName = getCropName(cropCycle);
  const growthStage =
    typeof cropCycle.currentStage === "string"
      ? cropCycle.currentStage.trim()
      : "";

  // 3. Separate approved evidence from internal candidates.
  // Draft and rights-restricted candidates are not farmer-facing evidence.
  const symptomCandidates =
    knowledgeMatch?.symptomCandidates || [];

  const clarificationCandidates =
    knowledgeMatch?.clarificationCandidates || [];

  const approvedSymptomCandidates =
    symptomCandidates.filter(
      (candidate) =>
        candidate.canSupportFarmerRecommendation === true
    );

  const approvedClarificationCandidates =
    clarificationCandidates.filter(
      (candidate) =>
        candidate.canSupportFarmerRecommendation === true
    );

  // 4. Always provide safe, practical interim guidance.
  const interimGuidance = buildInterimGuidance(
    cropHealthObservation,
    cropName
  );

  let recommendation = interimGuidance.recommendation;

  let reason =
    `The farmer has reported a crop-health problem affecting ${cropName}. ` +
    "The specific cause has not yet been confirmed. AgriMama is providing practical inspection steps while gathering more information.";

  if (growthStage) {
    reason += ` The crop is currently at the ${growthStage} stage.`;
  }

  // 5. Use approved knowledge only when it is eligible.
  // Do not expose draft or rights-unverified record content.
  if (approvedSymptomCandidates.length > 0) {
    reason +=
      " Relevant approved agricultural knowledge is available to support further assessment. The symptoms still require field verification before confirming a cause.";
  } else {
    reason +=
      " No agricultural knowledge record is currently cleared to support a specific farmer-facing diagnosis. General interim guidance is still available.";
  }

  // 6. Prefer physical weather station measurements.
  const latestWeather = weather[0] || null;

  let weatherSourceUsed = "none";

  if (latestWeather) {
    const weatherDetails = [];

    if (latestWeather.temperature != null) {
      weatherDetails.push(
        `temperature ${latestWeather.temperature}`
      );
    }

    if (latestWeather.humidity != null) {
      weatherDetails.push(
        `humidity ${latestWeather.humidity}`
      );
    }

    if (latestWeather.rainfall != null) {
      weatherDetails.push(
        `rainfall ${latestWeather.rainfall}`
      );
    }

    if (weatherDetails.length > 0) {
      weatherSourceUsed = "nua_sense";

      reason +=
        ` Recent measurements from a NuaSense weather station are available (${weatherDetails.join(", ")}). These measurements should be considered alongside field observations.`;
    }
  }

  // 7. If no station measurements are available,
  // use Open-Meteo model-based weather information.
  if (
    weatherSourceUsed === "none" &&
    weatherForecast?.available === true
  ) {
    const openMeteo = weatherForecast.sources?.find(
      (source) => source.source === "open_meteo"
    );

    if (openMeteo) {
      const weatherDetails = [];

      const current = openMeteo.current || {};
      const tomorrow = openMeteo.daily?.[1] || null;

      if (current.temperatureC != null) {
        weatherDetails.push(
          `estimated current temperature ${current.temperatureC}°C`
        );
      }

      if (current.relativeHumidityPercent != null) {
        weatherDetails.push(
          `estimated relative humidity ${current.relativeHumidityPercent}%`
        );
      }

      if (tomorrow?.precipitationSumMm != null) {
        weatherDetails.push(
          `tomorrow's forecast rainfall ${tomorrow.precipitationSumMm} mm`
        );
      }

      if (tomorrow?.precipitationProbabilityMax != null) {
        weatherDetails.push(
          `tomorrow's maximum forecast rain probability ${tomorrow.precipitationProbabilityMax}%`
        );
      }

      if (weatherDetails.length > 0) {
        weatherSourceUsed = "open_meteo";

        reason +=
          ` Open-Meteo model-based weather estimates and forecasts are available (${weatherDetails.join(", ")}). These are estimates, not direct farm measurements.`;
      }
    }
  }

  // 8. Prepare knowledge traceability metadata.
  const knowledgeMetadata = {
    retrievalStatus:
      knowledgeMatch?.status || "not_available",

    candidateCount:
      knowledgeMatch?.candidateCount || 0,

    symptomCandidateCount:
      symptomCandidates.length,

    clarificationCandidateCount:
      clarificationCandidates.length,

    ambiguous:
      knowledgeMatch?.ambiguous === true,

    eligibleEvidenceCount:
      approvedSymptomCandidates.length,

    eligibleClarificationCount:
      approvedClarificationCandidates.length,

    symptomCandidateIds:
      symptomCandidates.map(
        (candidate) => candidate.recordId
      ),

    clarificationCandidateIds:
      clarificationCandidates.map(
        (candidate) => candidate.recordId
      ),

    approvedEvidenceIds:
      approvedSymptomCandidates.map(
        (candidate) => candidate.recordId
      ),

    withheldCandidateIds: [
      ...new Set([
        ...symptomCandidates
          .filter(
            (candidate) =>
              candidate.canSupportFarmerRecommendation !== true
          )
          .map((candidate) => candidate.recordId),

        ...clarificationCandidates
          .filter(
            (candidate) =>
              candidate.canSupportFarmerRecommendation !== true
          )
          .map((candidate) => candidate.recordId)
      ])
    ]
  };

  // 9. Return the structured decision.
  return {
    type: "inspection",

    actionCode: "INSPECT_CROP_DAMAGE",

    observationId: cropHealthObservation.id,

    recommendation,
    reason,

    priority: "normal",

    requiresHumanReview: false,

    source: "AgriMama crop health rule",

    language:
      cropHealthObservation.responseLanguage ||
      cropHealthObservation.language ||
      farmer?.preferredLanguage ||
      "en",

    metadata: {
      crop: cropName,

      growthStage: growthStage || null,

      observationCategory:
        cropHealthObservation.category || null,

      riskLevel: "moderate",

      adviceType: interimGuidance.adviceType,

      diagnosisConfirmed: false,

      expertReviewRecommended: false,

      followUpQuestion: interimGuidance.followUpQuestion,

      nextSteps: interimGuidance.nextSteps,

      weatherAvailable:
        weather.length > 0 ||
        weatherForecast?.available === true,

      weatherStationCount:
        context.weatherStations?.length || 0,

      weatherSourceUsed,

      weatherForecastAvailable:
        weatherForecast?.available === true,

      farmId: farm?.id || null,

      knowledgeContext: knowledgeMetadata
    }
  };
}
