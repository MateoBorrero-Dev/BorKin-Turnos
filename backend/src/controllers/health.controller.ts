import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

export function health(_req: Request, res: Response) {
  res.set("Cache-Control", "no-store").json({ success: true, data: { status: "ok" } });
}

export async function ready(_req: Request, res: Response) {
  await prisma.$queryRaw`SELECT 1`;
  res.set("Cache-Control", "no-store").json({ success: true, data: { status: "ready", database: "connected" } });
}
