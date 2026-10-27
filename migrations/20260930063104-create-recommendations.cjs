"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("recommendations", {
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
        allowNull: false,
        references: {
          model: "crop_cycles",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      observation_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "farmer_observations",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: "action",
      },

      recommendation: {
        type: Sequelize.TEXT,
        allowNull: false,
      },

      reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      priority: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "normal",
      },

      status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "pending",
      },

      source: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      language: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },

      requires_human_review: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      reviewed_by: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      reviewed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("recommendations");
  },
};