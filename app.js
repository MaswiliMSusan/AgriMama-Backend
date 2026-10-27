import "dotenv/config";
import Fastify from "fastify";
import sequelize from "./src/config/database.js";
import decisionRoutes from "./src/routes/decisions.js";
import observationRoutes from "./src/routes/observations.js";
import messageRoutes from "./src/routes/messages.js";
import inboundSmsRoutes from "./src/routes/inboundSms.js";

const app = Fastify({
  logger: true,
});

const PORT = Number(process.env.PORT) || 7000;
const HOST = process.env.HOST || "0.0.0.0";

// --------------------------------------------------
// Routes

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