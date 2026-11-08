
import { evaluateWeatherForecastRisk } from "./src/services/decisionRules/weatherForecastRisk.js";

const context = {
  cropCycle: {
    id: "test-crop-cycle-001",
    cropType: "maize",
  },

  triggeringObservation: {
    id: "test-observation-001",
    category: "weather",
    description: "The sky has been cloudy this week.",
  },

  weatherForecast: {
    available: true,
    sources: [
      {
        source: "open_meteo",
        sourceType: "forecast_model",
        daily: [
          {
            date: "2026-11-04",
            precipitationSumMm: 3.5,
          },
          {
            date: "2026-11-05",
            precipitationSumMm: 0.2,
          },
          {
            date: "2026-11-06",
            precipitationSumMm: 0.5,
          },
          {
            date: "2026-11-07",
            precipitationSumMm: 0.3,
          },
        ],
      },
    ],
  },
};

const result = evaluateWeatherForecastRisk(context);

console.log("\nWeather Forecast Risk Test:");
console.log(JSON.stringify(result, null, 2));

if (result?.actionCode === "MONITOR_DRY_SPELL") {
  console.log("\nPASS: The forecast risk rule matched.");
} else {
  console.log("\nFAIL: The forecast risk rule did not match.");
}
