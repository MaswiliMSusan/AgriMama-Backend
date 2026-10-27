
import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const SmsInboundMessage = sequelize.define(
    "SmsInboundMessage",
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false,
        },
        providerMessageId: {
            type: DataTypes.STRING(150),
            allowNull: false,
            unique: true,
            field: "provider_message_id",
        },
        fromPhone: {
            type: DataTypes.STRING(30),
            allowNull: false,
            field: "from_phone",
        },
        messageText: {
            type: DataTypes.TEXT,
            allowNull: false,
            field: "message_text",
        },
        status: {
            type: DataTypes.STRING(30),
            allowNull: false,
            defaultValue: "received",
        },
        receivedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: "received_at",
        },
        processedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: "processed_at",
        },
        errorMessage: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: "error_message",
        },
    },
    {
        tableName: "sms_inbound_messages",
        timestamps: true,
        underscored: false,
    }
);

export default SmsInboundMessage;
