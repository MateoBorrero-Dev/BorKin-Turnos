import { afterEach, describe, expect, it, vi } from "vitest";
import { apiDownload, apiRequest, assetUrl, resolveApiUrl, setAccessToken, subscribeSessionExpired } from "./client";

afterEach(() => { vi.unstubAllGlobals(); setAccessToken(null); });

describe("cliente HTTP", () => {
  it("deja que el navegador genere el Content-Type con boundary para FormData", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(init?.body).toBeInstanceOf(FormData);
      expect(headers.has("content-type")).toBe(false);
      expect(headers.get("authorization")).toBe("Bearer access-test");
      return new Response(JSON.stringify({ success: true, data: { uploaded: true } }), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    setAccessToken("access-test");
    const body = new FormData(); body.append("logo", new Blob(["image"]), "logo.png");
    await expect(apiRequest<{ uploaded: boolean }>("/settings/business/logo", { method: "PUT", body })).resolves.toEqual({ uploaded: true });
  });

  it("mantiene application/json para cuerpos JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
      return new Response(JSON.stringify({ success: true, data: {} }), { status: 200, headers: { "content-type": "application/json" } });
    }));
    await apiRequest("/test", { method: "POST", body: JSON.stringify({ value: true }) });
  });

  it("resuelve /uploads contra el origen configurado de la API", () => {
    expect(assetUrl("/uploads/business/logo.png")).toBe("http://localhost:3000/uploads/business/logo.png");
    expect(assetUrl(null)).toBeNull();
  });

  it("respeta el fallback same-origin y una URL configurada", () => {
    expect(resolveApiUrl(undefined, "/api")).toBe("/api");
    expect(resolveApiUrl(undefined, "http://localhost:3000/api")).toBe("http://localhost:3000/api");
    expect(resolveApiUrl("https://api.example.com/api", "/api")).toBe("https://api.example.com/api");
  });

  it("descarga CSV autenticado y conserva el nombre del backend", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer csv-token");
      return new Response("\uFEFFFecha;Importe\r\n", { status: 200, headers: { "content-type": "text/csv", "content-disposition": 'attachment; filename="ventas.csv"' } });
    }));
    setAccessToken("csv-token");
    const result = await apiDownload("/reports/sales/export?from=2026-08-01&to=2026-08-31");
    expect(result.filename).toBe("ventas.csv");
    expect(await result.blob.text()).toContain("Fecha;Importe");
  });

  it("comparte un único refresh entre solicitudes 401 concurrentes y reintenta una vez", async () => {
    let privateCalls = 0;
    let refreshCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        await Promise.resolve();
        return new Response(JSON.stringify({ success: true, data: { accessToken: "renewed", user: {} } }), { status: 200 });
      }
      privateCalls += 1;
      if (privateCalls <= 2) return new Response(JSON.stringify({ success: false, message: "Sesión vencida", code: "AUTH_REQUIRED" }), { status: 401 });
      return new Response(JSON.stringify({ success: true, data: { ok: true } }), { status: 200 });
    }));

    await expect(Promise.all([apiRequest("/private"), apiRequest("/private")])).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(refreshCalls).toBe(1);
    expect(privateCalls).toBe(4);
  });

  it("notifica una sola vez cuando el refresh expiró", async () => {
    const expired = vi.fn();
    const unsubscribe = subscribeSessionExpired(expired);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify({ success: false, message: "Sesión vencida", code: "AUTH_REQUIRED" }), { status: String(input).endsWith("/auth/refresh") ? 401 : 401 })));
    await expect(apiRequest("/private")).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("convierte fallos de red en un error seguro y accionable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("failed to fetch private details"); }));
    await expect(apiRequest("/private", {}, false)).rejects.toMatchObject({ status: 0, code: "NETWORK_ERROR", message: expect.stringContaining("conectar") });
  });
});
