import { Router } from "express";
import * as controller from "../controllers/analytics.controller.js";
import { authenticate, requirePermission } from "../middleware/auth.middleware.js";

export const analyticsRouter = Router();
analyticsRouter.use(authenticate);
analyticsRouter.get("/dashboard", requirePermission("dashboard.view"), controller.dashboard);
analyticsRouter.get("/options", requirePermission("statistics.view"), controller.options);
analyticsRouter.get("/overview", requirePermission("statistics.view"), controller.overview);
analyticsRouter.get("/timeseries", requirePermission("statistics.view"), controller.timeseries);
analyticsRouter.get("/rankings", requirePermission("statistics.view"), controller.rankings);

export const reportRouter = Router();
reportRouter.use(authenticate, requirePermission("reports.view"));
reportRouter.get("/:kind/export", controller.exportCsv);
reportRouter.get("/:kind", controller.report);

export const auditRouter = Router();
auditRouter.use(authenticate, requirePermission("audit.view"));
auditRouter.get("/options", controller.auditOptions);
auditRouter.get("/", controller.auditList);
