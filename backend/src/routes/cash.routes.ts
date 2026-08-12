import { Router } from "express";
import * as controller from "../controllers/cash.controller.js";
import { authenticate, requirePermission } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { cashMovementSchema, closeCashSchema, openCashSchema } from "../validators/cash.validators.js";

export const cashRouter = Router();
cashRouter.use(authenticate);
cashRouter.get("/current", requirePermission("cash.view"), controller.current);
cashRouter.post("/open", requirePermission("cash.open"), validateBody(openCashSchema), controller.open);
cashRouter.post("/close", requirePermission("cash.close"), validateBody(closeCashSchema), controller.close);
cashRouter.post("/income", requirePermission("cash.movements"), validateBody(cashMovementSchema), controller.income);
cashRouter.post("/expense", requirePermission("cash.movements"), validateBody(cashMovementSchema), controller.expense);
cashRouter.post("/withdrawal", requirePermission("cash.movements"), validateBody(cashMovementSchema), controller.withdrawal);
cashRouter.get("/history", requirePermission("cash.view"), controller.history);
cashRouter.get("/:id/movements", requirePermission("cash.view"), controller.movements);
cashRouter.get("/:id", requirePermission("cash.view"), controller.detail);

export const paymentMethodRouter = Router();
paymentMethodRouter.use(authenticate);
paymentMethodRouter.get("/options", requirePermission("payments.charge"), controller.paymentMethods);
