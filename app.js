import "dotenv/config";
import Fastify from "fastify";
import sequelize from "./src/config/database.js";
import decisionRoutes from "./src/routes/decisions.js";
import observationRoutes from "./src/routes/observations.js";
import messageRoutes from "./src/routes/messages.js";
import inboundSmsRoutes from "./src/routes/inboundSms.js";
import farmerRoutes from "./src/routes/farmers.js";
import farmRoutes from "./src/routes/farms.js";
import cropCycleRoutes from "./src/routes/cropCycles.js";
import cookie from "@fastify/cookie";
import farmerAuthRoutes from "./src/routes/auth/farmerAuth.js";
import sessionRoutes from "./src/routes/auth/sessionRoutes.js";
import staffAuthRoutes from "./src/routes/auth/staffAuth.js";
import conversationRoutes from "./src/routes/conversations.js";
import assistantRoutes from "./src/routes/assistant.js";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";


const app = Fastify({
  logger: true,
});

const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN || "http://localhost:5173";

await app.register(cors, {
  origin: FRONTEND_ORIGIN,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});

await app.register(cookie);

await app.register(rateLimit, {
  global: false,
});

const PORT = Number(process.env.PORT) || 7000;
const HOST = process.env.HOST || "0.0.0.0";

// --------------------------------------------------
// Routes

app.decorateRequest("authUser", null);
app.decorateRequest("authSession", null);

await app.register(staffAuthRoutes, {
  prefix: "/api/auth/staff",
});

await app.register(sessionRoutes, {
  prefix: "/api/auth",
});

await app.register(farmerAuthRoutes, {
  prefix: "/api/auth/farmer",
});

await app.register(decisionRoutes, {
  prefix: "/api",
});

await app.register(observationRoutes, {
  prefix: "/api",
});

await app.register(messageRoutes, {
  prefix: "/api",
});

await app.register(inboundSmsRoutes, {
  prefix: "/api",
});

await app.register(farmerRoutes, {
  prefix: "/api",
});

await app.register(farmRoutes, {
  prefix: "/api",
});

await app.register(cropCycleRoutes, {
  prefix: "/api",
});

await app.register(conversationRoutes, {
  prefix: "/api",
});

await app.register(assistantRoutes, {
  prefix: "/api",
});

console.log(app.printRoutes());

// --------------------------------------------------

app.get("/", async () => {
  return {
    name: "AgriMama API",
    message: "AgriMama backend is running",
    version: "0.1.0",
  };
});

app.get("/health", async () => {
  try {
    await sequelize.authenticate();

    return {
      status: "ok",
      service: "agrimama-api",
      database: "connected",
    };
  } catch (error) {
    return {
      status: "error",
      service: "agrimama-api",
      database: "disconnected",
      error: error.message,
    };
  }
});

// --------------------------------------------------
// Start application
// --------------------------------------------------

const start = async () => {
  try {
    console.log("Connecting to database...");

    await sequelize.authenticate();

    console.log("Database connection successful!");
    console.log("PostgreSQL is connected.");

    await app.listen({
      port: PORT,
      host: HOST,
    });

    console.log(`AgriMama API running on http://localhost:${PORT}`);
  } catch (error) {
    console.error("Failed to start AgriMama API.");

    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error code:", error.original?.code || "N/A");

    process.exit(1);
  }
};

start();