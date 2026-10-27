
"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("conversations", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        allowNull: false,
        primaryKey: true,
      },

      farmer_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "farmers", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      farm_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "farms", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      crop_cycle_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "crop_cycles", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      observation_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "farmer_observations",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      question: {
        type: Sequelize.TEXT,
        allowNull: false,
      },

      answer: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      answer_observation_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "farmer_observations",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "awaiting_reply",
      },

      asked_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },

      completed_at: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex(
      "conversations",
      ["farmer_id", "status"],
      { name: "conversations_farmer_status_idx" }
    );

    await queryInterface.addIndex(
      "conversations",
      ["observation_id"],
      { name: "conversations_observation_id_idx" }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("conversations");
  },
};
