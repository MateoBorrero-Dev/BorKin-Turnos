import { randomUUID } from "node:crypto";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { errorHandler, notFound } from "./middleware/error.middleware.js";
import { apiRouter } from "./routes/index.js";
import { uploadsDirectory } from "./services/storage.service.js";

export function createApp() {
  const app = express();
  if (env.NODE_ENV === "production") app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(pinoHttp({ logger, genReqId: (req) => req.headers["x-request-id"]?.toString() ?? randomUUID() }));
  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true, methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"] }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use("/uploads", express.static(uploadsDirectory, {
    fallthrough: false,
    maxAge: "1d",
    setHeaders: (response) => {
      // Las imágenes viven en el origen del backend y se embeben desde el
      // frontend. La excepción CORP se limita estrictamente a archivos servidos
      // por /uploads; Helmet conserva su política general para el resto.
      response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  }));
  app.use("/api", apiRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
