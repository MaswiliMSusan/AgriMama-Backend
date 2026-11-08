
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
  } = context;

  if (!cropCycle) {
    throw new Error("Crop cycle is required.");
  }

  // 1. Prefer the observation that triggered this decision.
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

  // 4. Prefer physical weather station measurements.
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
        ` Recent measurements from a NuaSense weather station are available (${weatherDetails.join(", ")}). These measurements should be considered alongside what the farmer observes in the field.`;
    }
  }

  // 5. If no station measurements are available,
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

      if (tomorrow) {
        if (tomorrow.precipitationSumMm != null) {
          weatherDetails.push(
            `tomorrow's forecast rainfall ${tomorrow.precipitationSumMm} mm`
          );
        }

        if (tomorrow.precipitationProbabilityMax != null) {
          weatherDetails.push(
            `tomorrow's maximum forecast rain probability ${tomorrow.precipitationProbabilityMax}%`
          );
        }
      }

      if (weatherDetails.length > 0) {
        weatherSourceUsed = "open_meteo";

        reason +=
          ` Open-Meteo model-based weather estimates and forecasts are available (${weatherDetails.join(", ")}). These are not direct farm measurements and should be considered alongside what the farmer observes in the field.`;
      }
    }
  }

  // 6. Return the structured decision.
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
    cropHealthObservation.language ||
    farmer?.preferredLanguage ||
    "en",

  metadata: {
    crop: cropCycle.crop || null,
    growthStage: cropCycle.currentStage || null,
    observationCategory:
      cropHealthObservation.category || null,

    // Advisory safety classification
    riskLevel: "moderate",
    adviceType: "safe_interim_guidance",
    diagnosisConfirmed: false,
    expertReviewRecommended: false,

    weatherAvailable:
      weather.length > 0 ||
      weatherForecast?.available === true,

    weatherStationCount:
      context.weatherStations?.length || 0,

    weatherSourceUsed,

    weatherForecastAvailable:
      weatherForecast?.available === true,

    farmId: farm?.id || null,
  },
};
}
