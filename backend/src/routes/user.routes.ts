import { Router } from "express";
import * as controller from "../controllers/user.controller.js";
import { authenticate, requirePermission } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { createUserSchema, resetPasswordSchema, updateUserSchema } from "../validators/user.validators.js";

export const userRouter = Router();
userRouter.use(authenticate, requirePermission("users.manage"));
userRouter.get("/", controller.list);
userRouter.post("/", validateBody(createUserSchema), controller.create);
userRouter.patch("/:id", validateBody(updateUserSchema), controller.update);
userRouter.post("/:id/reset-password", validateBody(resetPasswordSchema), controller.resetPassword);

export const accessRouter = Router();
accessRouter.use(authenticate, requirePermission("users.manage"));
accessRouter.get("/roles", controller.roles);
accessRouter.get("/permissions", controller.permissions);
