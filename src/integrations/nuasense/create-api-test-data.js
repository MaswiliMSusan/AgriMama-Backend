import sequelize from "../../config/database.js";
import Farmer from "../../models/farmer.js";
import Farm from "../../models/farm.js";
import CropCycle from "../../models/cropCycle.js";
import WeatherStation from "../../models/weatherStation.js";
import FarmWeatherStation from "../../models/farmWeatherStation.js";
import FarmerObservation from "../../models/farmerObservation.js";

async function createTestData() {
  try {
    console.log("🌱 Creating persistent API test data...\n");

    const farmer = await Farmer.create({
      name: "AgriMama API Test Farmer",
      phone: `+254711${Date.now().toString().slice(-6)}`,
      preferredLanguage: "dholuo",
      consentStatus: true,
      consentAt: new Date(),
    });

    console.log(`👩 Farmer: ${farmer.id}`);

    const farm = await Farm.create({
      farmerId: farmer.id,
      name: "AgriMama API Test Farm",
      sizeAcres: 2,
      latitude: -0.55,
      longitude: 34.75,
    });

    console.log(`🌱 Farm: ${farm.id}`);

    const cropCycle = await CropCycle.create({
      farmId: farm.id,
      crop: "maize",
      variety: "test variety",
      plantingDate: new Date(),
      currentStage: "vegetative_growth",
      status: "active",
    });

    console.log(`🌽 Crop cycle: ${cropCycle.id}`);

    const weatherStation = await WeatherStation.findOne({
      where: {
        provider: "nuasense",
        gatewayId: "704bcafffe69cbc0",
      },
    });

    if (!weatherStation) {
      throw new Error("NuaSense weather station was not found.");
    }

    console.log(`🌦️ Weather station: ${weatherStation.id}`);

    const farmWeatherStation = await FarmWeatherStation.create({
      farmId: farm.id,
      weatherStationId: weatherStation.id,
      activeFrom: new Date(),
      active: true,
    });

    console.log(
      `🔗 Farm-weather relationship: ${farmWeatherStation.id}`
    );

    const observation = await FarmerObservation.create({
      farmerId: farmer.id,
      farmId: farm.id,
      cropCycleId: cropCycle.id,
      category: "weather",
      observation:
        "The rain has stopped and the soil is becoming dry.",
      observedAt: new Date(),
      source: "farmer",
      language: "dholuo",
    });

    console.log(`📝 Observation: ${observation.id}`);

    console.log("\n✅ API test data created successfully.\n");

    console.log("Use this cropCycleId for the API test:");
    console.log(`\n${cropCycle.id}\n`);

    console.log("Farmer ID:");
    console.log(farmer.id);

    console.log("\nFarm ID:");
    console.log(farm.id);

    console.log("\nObservation ID:");
    console.log(observation.id);

    console.log(
      "\n⚠️ This data is intentionally NOT deleted."
    );

    console.log(
      "We will use it to test POST /api/decisions."
    );
  } catch (error) {
    console.error("❌ Failed to create API test data.");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

createTestData();