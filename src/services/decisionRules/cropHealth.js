
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
    triggeringObservation = null,
  } = context;

  if (!cropCycle) {
    throw new Error("Crop cycle is required.");
  }

  // 1. Prefer the observation that triggered this decision.
  // Do not use an older crop-health report when the current
  // message belongs to a different category.
  const cropHealthObservation = triggeringObservation
    ? (
        triggeringObservation.category?.toLowerCase().trim() ===
        "crop_health"
          ? triggeringObservation
          : null
      )
    : (
        observations.find(
          (observation) =>
            observation.category?.toLowerCase().trim() ===
            "crop_health"
        ) || null
      );

  if (!cropHealthObservation) {
    return null;
  }

  // 2. Extract crop context.
  const crop = cropCycle.crop?.toLowerCase().trim();
  const growthStage = cropCycle.currentStage?.toLowerCase().trim();

  // 3. Recommend inspection before treatment.
  const recommendation =
    "Inspect several affected plants and record what the leaf damage looks like before applying any pesticide.";

  let reason =
    "The farmer has reported a crop-health problem, but the specific cause has not yet been confirmed. AgriMama should gather more information before recommending treatment.";

  if (crop && growthStage) {
    reason += ` The crop is ${crop} and is currently at the ${growthStage} stage.`;
  }

  // 4. Add available weather as supporting context.
  const latestWeather = weather[0] || null;

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
      reason += ` Recent weather information is available (${weatherDetails.join(
        ", "
      )}), but it should be considered alongside what the farmer observes in the field.`;
    }
  }

  // 5. Return the structured decision.
  return {
    type: "inspection",
    actionCode: "INSPECT_CROP_DAMAGE",
    observationId: cropHealthObservation.id,

    recommendation,
    reason,

    priority: "normal",
    requiresHumanReview: true,
    source: "AgriMama crop health rule",

    language:
      cropHealthObservation.language ||
      farmer?.preferredLanguage ||
      "en",

    metadata: {
      crop: cropCycle.crop || null,
      growthStage: cropCycle.currentStage || null,
      observationCategory:
        cropHealthObservation.category || null,
      weatherAvailable: weather.length > 0,
      weatherStationCount:
        context.weatherStations?.length || 0,
      farmId: farm?.id || null,
    },
  };
}
