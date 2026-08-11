import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { ApiError } from "../utils/api-error.js";

export const notFound: RequestHandler = (_req, _res, next) => next(new ApiError(404, "Recurso no encontrado.", "NOT_FOUND"));

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ success: false, message: "Revisá los datos ingresados.", code: "VALIDATION_ERROR", details: error.flatten() });
    return;
  }
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({ success: false, message: error.message, ...(error.code ? { code: error.code } : {}), ...(error.details ? { details: error.details } : {}) });
    return;
  }
  if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
    res.status(409).json({ success: false, message: "Ya existe un registro con esos datos.", code: "CONFLICT" });
    return;
  }
  logger.error({ err: error, requestId: req.id }, "Unhandled request error");
  res.status(500).json({ success: false, message: "Ocurrió un error inesperado.", ...(env.NODE_ENV === "development" ? { code: "INTERNAL_ERROR" } : {}) });
};
