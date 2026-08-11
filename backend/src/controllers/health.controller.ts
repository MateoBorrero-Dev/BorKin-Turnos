import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

export async function health(_req: Request, res: Response) {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ success: true, data: { status: "ok", database: "connected" } });
}
