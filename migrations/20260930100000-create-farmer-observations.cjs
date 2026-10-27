"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("farmer_observations", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
        allowNull: false,
      },

      farmer_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "farmers",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
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

      crop_cycle_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "crop_cycles",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      category: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      observation: {
        type: Sequelize.TEXT,
        allowNull: false,
      },

      observed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },

      source: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: "farmer",
      },

      language: {
        type: Sequelize.STRING(50),
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable("farmer_observations");
  },
};