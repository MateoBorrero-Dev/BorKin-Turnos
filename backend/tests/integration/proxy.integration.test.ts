import { readFile } from "node:fs/promises";
import path from "node:path";
import express from "express";
import rateLimit from "express-rate-limit";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { parseEnvironment } from "../../src/config/env.js";
import { clientIpRateLimitKey, configureProxyTrust } from "../../src/config/proxy.js";

function probeApp(trustedHops: number, limited = false) {
  const app = express();
  configureProxyTrust(app, trustedHops);
  if (limited) app.use(rateLimit({ windowMs: 60_000, limit: 1, keyGenerator: clientIpRateLimitKey, standardHeaders: false, legacyHeaders: false }));
  app.get("/probe", (req, res) => res.json({ ip: req.ip, protocol: req.protocol, key: clientIpRateLimitKey(req) }));
  return app;
}

const productionEnvironment = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://borkin:password@postgres:5432/borkin?schema=public",
  FRONTEND_URL: "https://turnos.example.com",
  JWT_SECRET: "proxy-test-access-secret-with-more-than-32-chars",
  JWT_REFRESH_SECRET: "proxy-test-refresh-secret-different-and-long",
  COOKIE_SECURE: "true",
};

describe("Fase 8 — cadena de proxies", () => {
  it("valida saltos explícitos en producción y mantiene desarrollo directo", () => {
    expect(parseEnvironment({ ...productionEnvironment, TRUST_PROXY_HOPS: "2" }).TRUST_PROXY_HOPS).toBe(2);
    expect(() => parseEnvironment(productionEnvironment)).toThrow(/TRUST_PROXY_HOPS/);
    expect(() => parseEnvironment({ ...productionEnvironment, TRUST_PROXY_HOPS: "arbitrario" })).toThrow(/TRUST_PROXY_HOPS/);
    expect(parseEnvironment({ ...productionEnvironment, NODE_ENV: "development", FRONTEND_URL: "http://localhost:5173", COOKIE_SECURE: "false" }).TRUST_PROXY_HOPS).toBe(0);
  });

  it("resuelve la IP original y HTTPS con los dos proxies soportados", async () => {
    const response = await request(probeApp(2))
      .get("/probe")
      .set("X-Forwarded-For", "203.0.113.10, 10.0.0.5")
      .set("X-Forwarded-Proto", "https");
    expect(response.body).toMatchObject({ ip: "203.0.113.10", protocol: "https", key: "203.0.113.10" });
  });

  it("mantiene IP y buckets distintos para clientes diferentes", async () => {
    const app = probeApp(2, true);
    const first = await request(app).get("/probe").set("X-Forwarded-For", "203.0.113.10, 10.0.0.5");
    const second = await request(app).get("/probe").set("X-Forwarded-For", "203.0.113.20, 10.0.0.5");
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.key).not.toBe(second.body.key);
  });

  it("ignora valores maliciosos agregados más allá de la frontera confiable", async () => {
    const app = probeApp(2, true);
    const first = await request(app).get("/probe").set("X-Forwarded-For", "203.0.113.10, 10.0.0.5");
    const spoofed = await request(app).get("/probe").set("X-Forwarded-For", "198.51.100.99, 203.0.113.10, 10.0.0.5");
    expect(first.body.ip).toBe("203.0.113.10");
    expect(spoofed.status).toBe(429);
  });

  it("sin proxy confiable ignora forwarded headers en desarrollo", async () => {
    const response = await request(probeApp(0))
      .get("/probe")
      .set("X-Forwarded-For", "203.0.113.10")
      .set("X-Forwarded-Proto", "https");
    expect(response.body.ip).toMatch(/127\.0\.0\.1|::1/);
    expect(response.body.protocol).toBe("http");
  });

  it("Nginx preserva sólo http/https y usa su scheme como fallback", async () => {
    const config = await readFile(path.resolve(import.meta.dirname, "../../../docker/nginx/default.conf"), "utf8");
    expect(config).toMatch(/map \$http_x_forwarded_proto \$borkin_forwarded_proto/);
    expect(config).toMatch(/default \$scheme;/);
    expect(config).toMatch(/~\*\^https\$ https;/);
    expect(config).toMatch(/~\*\^http\$ http;/);
    expect(config.match(/proxy_set_header X-Forwarded-Proto \$borkin_forwarded_proto;/g)).toHaveLength(3);
    expect(config).not.toMatch(/proxy_set_header X-Forwarded-Proto \$scheme;/);
  });
});
