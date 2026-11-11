
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const AuthOtp = sequelize.define(
  "AuthOtp",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    phone: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    otpHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "otp_hash",
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "expires_at",
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    consumedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "consumed_at",
    },
  },
  {
    tableName: "auth_otps",
    timestamps: true,
    underscored: true,
  }
);

export default AuthOtp;
