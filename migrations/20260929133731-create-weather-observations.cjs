"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("weather_observations", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        allowNull: false,
        primaryKey: true,
      },

      weather_station_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "weather_stations",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      recorded_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      temperature: {
        type: Sequelize.DECIMAL(8, 2),
        allowNull: true,
      },

      humidity: {
        type: Sequelize.DECIMAL(8, 2),
        allowNull: true,
      },

      pressure: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },

      rainfall: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },

      wind_speed: {
        type: Sequelize.DECIMAL(10, 4),
        allowNull: true,
      },

      wind_gusts: {
        type: Sequelize.DECIMAL(10, 4),
        allowNull: true,
      },

      wind_direction: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },

      latitude: {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      },

      longitude: {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      },

      battery_percent: {
        type: Sequelize.DECIMAL(6, 2),
        allowNull: true,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex("weather_observations", [
      "weather_station_id",
      "recorded_at",
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("weather_observations");
  },
};