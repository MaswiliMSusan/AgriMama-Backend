
"use strict";

const { DataTypes } = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("conversation_messages", {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },

      conversation_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "conversations",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      sender: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },

      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },

      channel: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "dashboard",
      },

      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },

      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });

    await queryInterface.addIndex("conversation_messages", [
      "conversation_id",
      "created_at",
    ], {
      name: "conversation_messages_conversation_created_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("conversation_messages");
  },
};
