export function mapWeatherObservation(row) {
  if (!row) {
    throw new Error("NuaSense weather row is required.");
  }

  if (!row.time) {
    throw new Error("NuaSense weather row is missing time.");
  }

  return {
    recordedAt: new Date(row.time),

    temperature: row.temperature ?? null,
    humidity: row.humidity ?? null,
    pressure: row.pressure ?? null,
    rainfall: row.rainfall ?? null,

    windSpeed: row.wind_speed ?? null,
    windGusts: row.wind_gusts ?? null,
    windDirection: row.wind_direction ?? null,

    latitude: row.gps_lat ?? null,
    longitude: row.gps_lon ?? null,

    batteryPercent: row.battery_percent ?? null,
  };
}