import { Router } from "express";
import * as controller from "../controllers/client.controller.js";
import { authenticate, requirePermission } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { createClientSchema, updateClientSchema } from "../validators/client.validators.js";

export const clientRouter = Router();
clientRouter.use(authenticate);
clientRouter.get("/", requirePermission("clients.view"), controller.list);
clientRouter.get("/options", requirePermission("clients.view"), controller.options);
clientRouter.get("/:id", requirePermission("clients.view"), controller.get);
clientRouter.post("/", requirePermission("clients.manage"), validateBody(createClientSchema), controller.create);
clientRouter.patch("/:id", requirePermission("clients.manage"), validateBody(updateClientSchema), controller.update);
clientRouter.post("/:id/disable", requirePermission("clients.manage"), controller.disable);
clientRouter.post("/:id/reactivate", requirePermission("clients.manage"), controller.reactivate);
