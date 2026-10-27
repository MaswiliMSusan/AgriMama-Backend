import "dotenv/config";

const BASE_URL =
  process.env.NUASENSE_API_BASE_URL || "https://api.nuasense.com";

const API_TOKEN = process.env.NUASENSE_API_TOKEN;

if (!API_TOKEN) {
  throw new Error("NUASENSE_API_TOKEN is not configured.");
}

export async function getFarmWeather({
  gatewayId,
  start = "-24h",
  fields = [
    "temperature",
    "humidity",
    "pressure",
    "rainfall",
    "wind_speed",
    "wind_gusts",
    "wind_direction",
    "gps_lat",
    "gps_lon",
    "battery_percent",
  ],
} = {}) {
  if (!gatewayId) {
    throw new Error("gatewayId is required.");
  }

  const url = new URL(
    "/api/nuasense/v1/farm/weather",
    BASE_URL
  );

  url.searchParams.set("start", start);
  url.searchParams.set("fields", fields.join(","));
  url.searchParams.set("gateway_id", gatewayId);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `NuaSense API request failed (${response.status}): ${errorText}`
    );
  }

  return response.json();
}