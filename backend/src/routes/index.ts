import { Router } from "express";
import { health } from "../controllers/health.controller.js";
import { accessRouter, userRouter } from "./user.routes.js";
import { authRouter } from "./auth.routes.js";

export const apiRouter = Router();
apiRouter.get("/health", health);
apiRouter.use("/auth", authRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/access", accessRouter);
