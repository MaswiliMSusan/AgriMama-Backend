"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("crop_cycles", {
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

      crop: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: "maize",
      },

      variety: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },

      planting_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      current_stage: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: "active",
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable("crop_cycles");
  },
};