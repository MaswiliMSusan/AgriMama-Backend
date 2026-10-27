import "dotenv/config";

import sequelize from "../../config/database.js";
import WeatherStation from "../../models/weatherStation.js";
import WeatherObservation from "../../models/weatherObservation.js";

async function checkCount() {
  try {
    await sequelize.authenticate();

    const station = await WeatherStation.findOne({
      where: {
        gatewayId: process.env.NUASENSE_GATEWAY_ID,
      },
    });

    if (!station) {
      throw new Error("Weather station was not found.");
    }

    const count = await WeatherObservation.count({
      where: {
        weatherStationId: station.id,
      },
    });

    console.log("Weather station:", station.id);
    console.log("Total weather observations in database:", count);
  } catch (error) {
    console.error("Count check failed:");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

checkCount();