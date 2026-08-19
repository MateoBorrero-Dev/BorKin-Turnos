import { describe, expect, it } from "vitest";
import { isPrivateBackendResource, pwaOptions } from "./pwa";

describe("política privada de la PWA", () => {
  it.each(["/api/appointments", "/uploads/business/logo.png", "/health/ready"])("clasifica %s como recurso de backend no cacheable", (pathname) => {
    expect(isPrivateBackendResource({ url: new URL(pathname, "https://api.borkin.test") })).toBe(true);
  });

  it("no clasifica los assets públicos compilados como datos privados", () => {
    expect(isPrivateBackendResource({ url: new URL("/assets/App-abc123.js", "https://app.borkin.test") })).toBe(false);
  });

  it("usa NetworkOnly y no configura sincronización en segundo plano", () => {
    expect(pwaOptions.workbox.runtimeCaching.map((rule) => rule.method)).toEqual(["GET", "POST", "PUT", "PATCH", "DELETE"]);
    expect(pwaOptions.workbox.runtimeCaching.every((rule) => rule.handler === "NetworkOnly")).toBe(true);
    expect(JSON.stringify(pwaOptions.workbox)).not.toContain("backgroundSync");
  });
});
