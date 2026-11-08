
const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

export async function getOpenMeteoWeather({
  latitude,
  longitude,
}) {
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("Valid farm latitude and longitude are required.");
  }

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current:
      "temperature_2m,relative_humidity_2m,precipitation,rain,showers,wind_speed_10m,wind_gusts_10m",
    daily:
      "precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min",
    forecast_days: "4",
    timezone: "auto",
  });

  const url = `${OPEN_METEO_URL}?${params.toString()}`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Open-Meteo request failed with status ${response.status}.`
    );
  }

  const data = await response.json();

  if (!data.current || !data.daily) {
    throw new Error("Open-Meteo returned an incomplete weather response.");
  }

  return {
    source: "open_meteo",
    sourceType: "forecast_model",
    fetchedAt: new Date().toISOString(),

    location: {
      latitude: data.latitude,
      longitude: data.longitude,
      timezone: data.timezone,
    },

    current: {
      validAt: data.current.time,
      temperatureC: data.current.temperature_2m,
      relativeHumidityPercent: data.current.relative_humidity_2m,
      precipitationMm: data.current.precipitation,
      rainMm: data.current.rain,
      showersMm: data.current.showers,
      windSpeedKmh: data.current.wind_speed_10m,
      windGustsKmh: data.current.wind_gusts_10m,
    },

    daily: (data.daily.time || []).map((date, index) => ({
      date,
      precipitationSumMm:
        data.daily.precipitation_sum?.[index] ?? null,
      precipitationProbabilityMax:
        data.daily.precipitation_probability_max?.[index] ?? null,
      temperatureMaxC:
        data.daily.temperature_2m_max?.[index] ?? null,
      temperatureMinC:
        data.daily.temperature_2m_min?.[index] ?? null,
    })),

    units: {
      temperature: "°C",
      precipitation: "mm",
      humidity: "%",
      windSpeed: "km/h",
    },
  };
}
