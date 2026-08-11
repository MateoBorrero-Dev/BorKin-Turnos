import type { Request, Response } from "express";
import * as business from "../services/business.service.js";
import * as catalog from "../services/catalog.service.js";
import * as employees from "../services/employee.service.js";
import * as blocks from "../services/schedule-block.service.js";
import { paginationQuerySchema } from "../utils/pagination.js";
import { ApiError } from "../utils/api-error.js";

function actor(req: Request) { if (!req.auth) throw new ApiError(401, "Debes iniciar sesión."); return req.auth; }
function id(req: Request) { const value = req.params.id; if (typeof value !== "string") throw new ApiError(400, "Identificador inválido."); return value; }
function file(req: Request) { if (!req.file) throw new ApiError(400, "Seleccioná una imagen.", "FILE_REQUIRED"); return req.file.buffer; }

export async function getBusiness(req: Request, res: Response) { res.json({ success: true, data: await business.getBusiness(actor(req).businessId) }); }
export async function updateBusiness(req: Request, res: Response) { const auth = actor(req); res.json({ success: true, data: await business.updateBusiness(auth.businessId, auth.id, req.body) }); }
export async function uploadLogo(req: Request, res: Response) { const auth = actor(req); res.json({ success: true, data: await business.replaceLogo(auth.businessId, auth.id, file(req)) }); }
export async function deleteLogo(req: Request, res: Response) { const auth = actor(req); res.json({ success: true, data: await business.deleteLogo(auth.businessId, auth.id) }); }

export async function listCategories(req: Request, res: Response) { const result = await catalog.listCategories(actor(req).businessId, paginationQuerySchema.parse(req.query)); res.json({ success: true, ...result }); }
export async function categoryOptions(req: Request, res: Response) { res.json({ success: true, data: await catalog.categoryOptions(actor(req).businessId) }); }
export async function createCategory(req: Request, res: Response) { const auth = actor(req); res.status(201).json({ success: true, data: await catalog.createCategory(auth.businessId, auth.id, req.body) }); }
export async function updateCategory(req: Request, res: Response) { const auth = actor(req); res.json({ success: true, data: await catalog.updateCategory(auth.businessId, auth.id, id(req), req.body) }); }

export async function listServices(req: Request, res: Response) { const result = await catalog.listServices(actor(req).businessId, paginationQuerySchema.parse(req.query)); res.json({ success: true, ...result }); }
export async function serviceOptions(req: Request, res: Response) { res.json({ success: true, data: await catalog.serviceOptions(actor(req).businessId) }); }
export async function getService(req: Request, res: Response) { res.json({ success: true, data: await catalog.getService(actor(req).businessId, id(req)) }); }
export async function createService(req: Request, res: Response) { const auth = actor(req); res.status(201).json({ success: true, data: await catalog.createService(auth.businessId, auth.id, req.body) }); }
export async function updateService(req: Request, res: Response) { const auth = actor(req); res.json({ success: true, data: await catalog.updateService(auth.businessId, auth.id, id(req), req.body) }); }

export async function listEmployees(req: Request, res: Response) { const result = await employees.listEmployees(actor(req).businessId, paginationQuerySchema.parse(req.query)); res.json({ success: true, ...result }); }
export async function getEmployee(req: Request, res: Response) { res.json({ success: true, data: await employees.getEmployee(actor(req).businessId, id(req)) }); }
export async function createEmployee(req: Request, res: Response) { const auth = actor(req); res.status(201).json({ success: true, data: await employees.createEmployee(auth.businessId, auth.id, req.body) }); }
export async function updateEmployee(req: Request, res: Response) { const auth = actor(req); res.json({ success: true, data: await employees.updateEmployee(auth.businessId, auth.id, id(req), req.body) }); }
export async function uploadPhoto(req: Request, res: Response) { const auth = actor(req); res.json({ success: true, data: await employees.replacePhoto(auth.businessId, auth.id, id(req), file(req)) }); }
export async function deletePhoto(req: Request, res: Response) { const auth = actor(req); res.json({ success: true, data: await employees.deletePhoto(auth.businessId, auth.id, id(req)) }); }
export async function updateEmployeeServices(req: Request, res: Response) { const auth = actor(req); res.json({ success: true, data: await employees.updateServices(auth.businessId, auth.id, id(req), req.body.serviceIds) }); }
export async function getSchedules(req: Request, res: Response) { res.json({ success: true, data: await employees.getSchedules(actor(req).businessId, id(req)) }); }
export async function updateSchedules(req: Request, res: Response) { const auth = actor(req); res.json({ success: true, data: await employees.updateSchedules(auth.businessId, auth.id, id(req), req.body.intervals) }); }

export async function listBlocks(req: Request, res: Response) { const employeeId = typeof req.query.employeeId === "string" ? req.query.employeeId : undefined; res.json({ success: true, data: await blocks.listBlocks(actor(req).businessId, employeeId) }); }
export async function createBlock(req: Request, res: Response) { const auth = actor(req); res.status(201).json({ success: true, data: await blocks.createBlock(auth.businessId, auth.id, req.body) }); }
export async function updateBlock(req: Request, res: Response) { const auth = actor(req); res.json({ success: true, data: await blocks.updateBlock(auth.businessId, auth.id, id(req), req.body) }); }
export async function deleteBlock(req: Request, res: Response) { const auth = actor(req); await blocks.deleteBlock(auth.businessId, auth.id, id(req)); res.status(204).send(); }
