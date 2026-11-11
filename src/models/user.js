
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    farmerId: {
      type: DataTypes.UUID,
      allowNull: true,
      unique: true,
      field: "farmer_id",
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
    },
    phone: {
      type: DataTypes.STRING(30),
      allowNull: true,
      unique: true,
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "password_hash",
    },
    role: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_active",
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "last_login_at",
    },
  },
  {
    tableName: "users",
    timestamps: true,
    underscored: true,
  }
);

export default User;
