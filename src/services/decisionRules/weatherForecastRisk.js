
const DRY_SPELL_DAYS = 3;
const DAILY_RAINFALL_THRESHOLD_MM = 1;

export function evaluateWeatherForecastRisk(context) {
  if (!context) {
    throw new Error("Decision context is required.");
  }

  const {
    cropCycle,
    weatherForecast,
    triggeringObservation,
  } = context;

  if (!cropCycle) {
    throw new Error("Crop cycle is required.");
  }

  // Only evaluate forecast risk when the farmer's
  // triggering observation concerns weather or soil.
  const category =
    triggeringObservation?.category?.toLowerCase().trim();

  if (!["weather", "soil"].includes(category)) {
    return null;
  }

  if (weatherForecast?.available !== true) {
    return null;
  }

  const openMeteo = weatherForecast.sources?.find(
    (source) => source.source === "open_meteo"
  );

  if (!openMeteo || !Array.isArray(openMeteo.daily)) {
    return null;
  }

  // Exclude today and inspect the next three complete days.
  const forecastDays = openMeteo.daily.slice(1, 4);

  // Require all three days and valid rainfall values.
  if (forecastDays.length !== DRY_SPELL_DAYS) {
    return null;
  }

  const rainfallValues = forecastDays.map(
    (day) => day.precipitationSumMm
  );

  const hasValidRainfallData = rainfallValues.every(
    (rainfall) =>
      typeof rainfall === "number" &&
      Number.isFinite(rainfall) &&
      rainfall >= 0
  );

  if (!hasValidRainfallData) {
    return null;
  }

  const possibleDrySpell = rainfallValues.every(
    (rainfall) =>
      rainfall < DAILY_RAINFALL_THRESHOLD_MM
  );

  if (!possibleDrySpell) {
    return null;
  }

  const forecastSummary = forecastDays.map((day) => ({
    date: day.date,
    rainfallMm: day.precipitationSumMm,
  }));

  const totalForecastRainfall = rainfallValues.reduce(
    (total, rainfall) => total + rainfall,
    0
  );

  return {
    type: "information",
    actionCode: "MONITOR_DRY_SPELL",

    observationId: triggeringObservation.id,

    recommendation:
      "Monitor the field over the coming days. Check soil moisture in several areas and observe the maize for signs of water stress. Report any changes in crop condition to AgriMama.",

    reason:
      `Open-Meteo forecasts less than ${DAILY_RAINFALL_THRESHOLD_MM} mm of rainfall per day over the next ${DRY_SPELL_DAYS} complete forecast days, with a combined forecast of ${totalForecastRainfall.toFixed(1)} mm. This indicates a possible dry spell, not confirmed drought or actual soil moisture conditions. Field inspection is needed to establish the crop's condition.`,

    priority: "normal",
    requiresHumanReview: true,

    source: "AgriMama weather forecast risk rule",

    language:
      triggeringObservation.language || "en",

    metadata: {
      crop: cropCycle.crop || null,
      growthStage: cropCycle.currentStage || null,

      forecastSource: "open_meteo",
      forecastSourceType: "forecast_model",

      possibleDrySpell: true,
      forecastDaysEvaluated: DRY_SPELL_DAYS,
      dailyRainfallThresholdMm: DAILY_RAINFALL_THRESHOLD_MM,
      totalForecastRainfallMm: Number(
        totalForecastRainfall.toFixed(2)
      ),

      forecastRainfall: forecastSummary,

      farmId: context.farm?.id || null,
    },
  };
}
