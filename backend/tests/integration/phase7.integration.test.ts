import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";

afterEach(() => vi.restoreAllMocks());

describe("Fase 7 — disponibilidad, errores y headers", () => {
  const app = createApp();

  it("expone un liveness independiente de PostgreSQL y sin caché", async () => {
    const query = vi.spyOn(prisma, "$queryRaw");
    const response = await request(app).get("/health").set("X-Request-Id", "phase7-request");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { status: "ok" } });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["x-request-id"]).toBe("phase7-request");
    expect(query).not.toHaveBeenCalled();
  });

  it("expone readiness con conexión a PostgreSQL", async () => {
    vi.spyOn(prisma, "$queryRaw").mockResolvedValueOnce([{ "?column?": 1 }]);
    const response = await request(app).get("/health/ready");
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ status: "ready", database: "connected" });
  });

  it("responde 503 estable, trazable y sin filtrar detalles cuando PostgreSQL no está disponible", async () => {
    vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(Object.assign(new Error("Can't reach database server at private-host"), { code: "P1001" }));
    const response = await request(app).get("/health/ready");
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ success: false, code: "SERVICE_UNAVAILABLE", message: "El servicio no está disponible en este momento." });
    expect(response.body.requestId).toEqual(expect.any(String));
    expect(JSON.stringify(response.body)).not.toContain("private-host");
  });

  it("mantiene Helmet, limita CORS al frontend y no envía HSTS en test HTTP", async () => {
    const allowed = await request(app).get("/health").set("Origin", "http://localhost:5173");
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(allowed.headers["x-content-type-options"]).toBe("nosniff");
    expect(allowed.headers["cross-origin-resource-policy"]).toBe("same-origin");
    expect(allowed.headers["strict-transport-security"]).toBeUndefined();

    const disallowed = await request(app).get("/health").set("Origin", "https://evil.example");
    expect(disallowed.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("devuelve un 404 estable para rutas desconocidas", async () => {
    const response = await request(app).get("/api/no-existe");
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ success: false, message: "Recurso no encontrado.", code: "NOT_FOUND" });
  });
});
