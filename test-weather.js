
import { getWeatherForFarm } from "./src/services/weather/weatherProvider.js";

const farm = {
  latitude: -0.5,  // Replace with your farm's actual latitude
  longitude: 34.5, // Replace with your farm's actual longitude
};

const result = await getWeatherForFarm(farm);

console.log(JSON.stringify(result, null, 2));
