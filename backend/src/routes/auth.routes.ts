import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as controller from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireTrustedOrigin } from "../middleware/origin.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { loginSchema } from "../validators/auth.validators.js";
import { env } from "../config/env.js";
import { clientIpRateLimitKey } from "../config/proxy.js";

export const authRouter = Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, keyGenerator: clientIpRateLimitKey, skip: () => env.NODE_ENV === "test", standardHeaders: "draft-8", legacyHeaders: false, message: { success: false, message: "Demasiados intentos. Probá nuevamente más tarde.", code: "RATE_LIMITED" } });
const refreshLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 120, keyGenerator: clientIpRateLimitKey, skip: () => env.NODE_ENV === "test", standardHeaders: "draft-8", legacyHeaders: false, message: { success: false, message: "Demasiadas solicitudes de sesión. Probá nuevamente más tarde.", code: "RATE_LIMITED" } });

authRouter.post("/login", loginLimiter, validateBody(loginSchema), controller.login);
authRouter.post("/refresh", refreshLimiter, requireTrustedOrigin, controller.refresh);
authRouter.post("/logout", requireTrustedOrigin, controller.logout);
authRouter.get("/me", authenticate, controller.me);
