import { Router } from "express";
import * as controller from "../controllers/phase2.controller.js";
import { authenticate, requirePermission } from "../middleware/auth.middleware.js";
import { imageUpload } from "../middleware/upload.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { updateBusinessSchema } from "../validators/business.validators.js";
import { createEmployeeSchema, employeeSchedulesSchema, employeeServicesSchema, updateEmployeeSchema } from "../validators/employee.validators.js";
import { scheduleBlockSchema } from "../validators/schedule-block.validators.js";
import { categorySchema, createServiceSchema, updateServiceSchema } from "../validators/service.validators.js";

export const settingsRouter = Router();
settingsRouter.use(authenticate, requirePermission("settings.manage"));
settingsRouter.get("/business", controller.getBusiness);
settingsRouter.patch("/business", validateBody(updateBusinessSchema), controller.updateBusiness);
settingsRouter.put("/business/logo", imageUpload.single("logo"), controller.uploadLogo);
settingsRouter.delete("/business/logo", controller.deleteLogo);

export const categoryRouter = Router();
categoryRouter.use(authenticate, requirePermission("services.manage"));
categoryRouter.get("/options", controller.categoryOptions);
categoryRouter.get("/", controller.listCategories);
categoryRouter.post("/", validateBody(categorySchema), controller.createCategory);
categoryRouter.patch("/:id", validateBody(categorySchema.partial()), controller.updateCategory);

export const serviceRouter = Router();
serviceRouter.use(authenticate, requirePermission("services.manage"));
serviceRouter.get("/options", controller.serviceOptions);
serviceRouter.get("/", controller.listServices);
serviceRouter.get("/:id", controller.getService);
serviceRouter.post("/", validateBody(createServiceSchema), controller.createService);
serviceRouter.patch("/:id", validateBody(updateServiceSchema), controller.updateService);

export const employeeRouter = Router();
employeeRouter.use(authenticate, requirePermission("employees.manage"));
employeeRouter.get("/", controller.listEmployees);
employeeRouter.post("/", validateBody(createEmployeeSchema), controller.createEmployee);
employeeRouter.get("/:id", controller.getEmployee);
employeeRouter.patch("/:id", validateBody(updateEmployeeSchema), controller.updateEmployee);
employeeRouter.put("/:id/photo", imageUpload.single("photo"), controller.uploadPhoto);
employeeRouter.delete("/:id/photo", controller.deletePhoto);
employeeRouter.put("/:id/services", validateBody(employeeServicesSchema), controller.updateEmployeeServices);
employeeRouter.get("/:id/schedules", controller.getSchedules);
employeeRouter.put("/:id/schedules", validateBody(employeeSchedulesSchema), controller.updateSchedules);

export const blockRouter = Router();
blockRouter.use(authenticate, requirePermission("employees.manage"));
blockRouter.get("/", controller.listBlocks);
blockRouter.post("/", validateBody(scheduleBlockSchema), controller.createBlock);
blockRouter.patch("/:id", validateBody(scheduleBlockSchema), controller.updateBlock);
blockRouter.delete("/:id", controller.deleteBlock);
