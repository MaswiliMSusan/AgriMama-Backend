
"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("users", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
        allowNull: false,
      },
      farmer_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "farmers",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
        unique: true,
      },
      name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true,
      },
      phone: {
        type: Sequelize.STRING(30),
        allowNull: true,
        unique: true,
      },
      password_hash: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      role: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      last_login_at: {
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

    await queryInterface.addConstraint("users", {
      fields: ["role"],
      type: "check",
      name: "users_role_check",
      where: {
        role: ["farmer", "admin", "staff"],
      },
    });

    await queryInterface.createTable("auth_otps", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
        allowNull: false,
      },
      phone: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      otp_hash: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      consumed_at: {
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

    await queryInterface.addIndex("auth_otps", ["phone"]);
    await queryInterface.addIndex("auth_otps", ["expires_at"]);

    await queryInterface.createTable("auth_sessions", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      token_hash: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      revoked_at: {
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

    await queryInterface.addIndex("auth_sessions", ["user_id"]);
    await queryInterface.addIndex("auth_sessions", ["expires_at"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("auth_sessions");
    await queryInterface.dropTable("auth_otps");
    await queryInterface.dropTable("users");
  },
};
