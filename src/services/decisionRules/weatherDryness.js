
export function evaluateWeatherDryness(context) {
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
  // Do not use an older weather report for a new message
  // that belongs to a different category.
  const weatherObservation = triggeringObservation
    ? (
        triggeringObservation.category?.toLowerCase().trim() ===
        "weather"
          ? triggeringObservation
          : null
      )
    : observations.find(
        (observation) =>
          observation.category?.toLowerCase().trim() === "weather"
      );

  if (!weatherObservation) {
    return null;
  }

  // 2. Check whether the observation indicates dryness.
  const observationText =
    weatherObservation.observation?.toLowerCase().trim() || "";

  const drynessIndicators = [
    "rain has stopped",
    "rain stopped",
    "soil is becoming dry",
    "soil is dry",
    "soil becoming dry",
    "dry soil",
    "dry conditions",
    "no rain",
    "not raining",
    "rains have stopped",
    "rains stopped",
  ];

  const indicatesDryness = drynessIndicators.some((indicator) =>
    observationText.includes(indicator)
  );

  if (!indicatesDryness) {
    return null;
  }

  // 3. Recommend checking the field before deciding what to do.
  const recommendation =
    "Check several areas of the field for soil moisture and inspect the crop for signs of water stress before deciding on the next action.";

  let reason =
    "The farmer has reported dry conditions. AgriMama should first confirm the condition of the soil and crop before recommending a specific water-management action.";

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
      )}), but it should be considered alongside the farmer's field observations.`;
    }
  }

  // 5. Add crop and growth-stage context.
  if (cropCycle.crop && cropCycle.currentStage) {
    reason += ` The crop is ${cropCycle.crop} and is currently at the ${cropCycle.currentStage} stage.`;
  }

  // 6. Return the structured decision.
  return {
    type: "inspection",
    actionCode: "CHECK_SOIL_MOISTURE",
    observationId: weatherObservation.id,

    recommendation,
    reason,

    priority: "normal",
    requiresHumanReview: true,
    source: "AgriMama weather dryness rule",

    language:
      weatherObservation.language ||
      farmer?.preferredLanguage ||
      "en",

    metadata: {
      crop: cropCycle.crop || null,
      growthStage: cropCycle.currentStage || null,
      observationCategory:
        weatherObservation.category || null,
      weatherAvailable: weather.length > 0,
      weatherStationCount:
        context.weatherStations?.length || 0,
      farmId: farm?.id || null,
    },
  };
}
