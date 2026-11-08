
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
    weatherForecast = null,
    triggeringObservation = null,
    weatherStations = [],
  } = context;

  if (!cropCycle) {
    throw new Error("Crop cycle is required.");
  }

  // 1. Accept both soil and weather observations.
  const acceptedCategories = ["weather", "soil"];

  const weatherObservation = triggeringObservation
    ? (
        acceptedCategories.includes(
          triggeringObservation.category?.toLowerCase().trim()
        )
          ? triggeringObservation
          : null
      )
    : observations.find((observation) =>
        acceptedCategories.includes(
          observation.category?.toLowerCase().trim()
        )
      ) || null;

  if (!weatherObservation) {
    return null;
  }

  // 2. Identify farmer-reported dryness.
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
    "little rain",
    "lack of rain",
    "water shortage",
    "soil moisture is low",
    "soil moisture is decreasing",
    "crops are drying",
    "plants are wilting",
  ];

  const farmerReportedDryness = drynessIndicators.some(
    (indicator) => observationText.includes(indicator)
  );

  // Do not infer actual soil dryness from forecasts alone.
  if (!farmerReportedDryness) {
    return null;
  }

  // 3. Recommend field inspection before taking action.
  const recommendation =
    "Check several areas of the field for soil moisture and inspect the crop for signs of water stress before deciding on the next action.";

  let reason =
    "The farmer has reported dry conditions. AgriMama should first confirm the condition of the soil and crop before recommending a specific water-management action.";

  // 4. Prefer physical NuaSense station measurements.
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
        ` Recent measurements from a NuaSense weather station are available (${weatherDetails.join(", ")}). These measurements should be considered alongside the farmer's field observations.`;
    }
  }

  // 5. Use Open-Meteo if physical station measurements are unavailable.
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

      // Exclude today because it may be a partially completed day.
      const forecastDays = openMeteo.daily?.slice(1, 3) || [];

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

      if (forecastDays.length > 0) {
        const totalForecastRainfall = forecastDays.reduce(
          (total, day) =>
            total + (Number(day.precipitationSumMm) || 0),
          0
        );

        weatherDetails.push(
          `forecast rainfall over the next ${forecastDays.length} days ${totalForecastRainfall.toFixed(1)} mm`
        );

        const probabilities = forecastDays
          .map((day) => day.precipitationProbabilityMax)
          .filter((value) => value != null);

        if (probabilities.length > 0) {
          weatherDetails.push(
            `maximum daily forecast rain probability ${Math.max(...probabilities)}%`
          );
        }
      }

      if (weatherDetails.length > 0) {
        weatherSourceUsed = "open_meteo";

        reason +=
          ` Open-Meteo model-based estimates and forecasts are available (${weatherDetails.join(", ")}). This forecast provides weather context only; it does not confirm actual soil moisture or rainfall received on the farm.`;
      }
    }
  }

  // 6. Add crop and growth-stage context.
  if (cropCycle.crop && cropCycle.currentStage) {
    reason +=
      ` The crop is ${cropCycle.crop} and is currently at the ${cropCycle.currentStage} stage.`;
  }

  // 7. Return the structured decision.
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

      weatherAvailable:
        weather.length > 0 ||
        weatherForecast?.available === true,

      weatherStationCount: weatherStations.length,

      weatherSourceUsed,

      weatherForecastAvailable:
        weatherForecast?.available === true,

      farmerReportedDryness: true,

      farmId: farm?.id || null,
    },
  };
}
