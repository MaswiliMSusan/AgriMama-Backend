"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      "recommendations",
      "metadata",
      {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(
      "recommendations",
      "metadata"
    );
  },
};