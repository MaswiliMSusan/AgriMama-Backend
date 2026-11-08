"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Crop selection happens before the farm, crop cycle
    // and observation are known.

    await queryInterface.changeColumn("conversations", "farm_id", {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: "farms",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await queryInterface.changeColumn("conversations", "crop_cycle_id", {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: "crop_cycles",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await queryInterface.changeColumn("conversations", "observation_id", {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: "farmer_observations",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await queryInterface.addColumn("conversations", "purpose", {
      type: Sequelize.STRING(40),
      allowNull: false,
      defaultValue: "observation_clarification",
    });

    await queryInterface.addColumn("conversations", "metadata", {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {},
    });

    await queryInterface.addIndex(
      "conversations",
      ["farmer_id", "purpose", "status"],
      {
        name: "conversations_farmer_purpose_status_idx",
      }
    );
  },

  async down(queryInterface, Sequelize) {
    // Prevent rollback if crop-selection conversations
    // still have NULL references.

    const [rows] = await queryInterface.sequelize.query(`
      SELECT COUNT(*)::int AS count
      FROM conversations
      WHERE farm_id IS NULL
         OR crop_cycle_id IS NULL
         OR observation_id IS NULL
    `);

    if (Number(rows[0]?.count || 0) > 0) {
      throw new Error(
        "Cannot roll back while conversations contain NULL farm, crop-cycle or observation references."
      );
    }

    await queryInterface.removeIndex(
      "conversations",
      "conversations_farmer_purpose_status_idx"
    );

    await queryInterface.removeColumn("conversations", "metadata");
    await queryInterface.removeColumn("conversations", "purpose");

    await queryInterface.changeColumn("conversations", "farm_id", {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: "farms",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await queryInterface.changeColumn("conversations", "crop_cycle_id", {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: "crop_cycles",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await queryInterface.changeColumn("conversations", "observation_id", {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: "farmer_observations",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  },
};