"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      "recommendations",
      "action_code",
      {
        type: Sequelize.STRING(100),
        allowNull: true,
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(
      "recommendations",
      "action_code"
    );
  },
};