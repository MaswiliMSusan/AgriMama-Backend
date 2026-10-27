"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.addConstraint("weather_observations", {
      fields: ["weather_station_id", "recorded_at"],
      type: "unique",
      name: "weather_observations_station_recorded_at_unique",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint(
      "weather_observations",
      "weather_observations_station_recorded_at_unique"
    );
  },
};