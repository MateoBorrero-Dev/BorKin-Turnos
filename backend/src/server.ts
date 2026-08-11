import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { prisma } from "./config/prisma.js";

await prisma.$connect();
const server = createServer(createApp());
server.listen(env.PORT, () => logger.info({ port: env.PORT, environment: env.NODE_ENV }, "BorKin Turnos API started"));

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down API");
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
