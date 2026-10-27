"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("farm_weather_stations", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        allowNull: false,
        primaryKey: true,
      },

      farm_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "farms",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
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

      active_from: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },

      active_to: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

    await queryInterface.addConstraint("farm_weather_stations", {
      fields: ["farm_id", "weather_station_id"],
      type: "unique",
      name: "farm_weather_stations_farm_station_unique",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("farm_weather_stations");
  },
};