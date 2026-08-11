import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest, assetUrl, setAccessToken } from "./client";

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
});
