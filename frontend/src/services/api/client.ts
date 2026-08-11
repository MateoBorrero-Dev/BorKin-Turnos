import type { ApiEnvelope, ApiErrorBody, AuthPayload } from "../../types/api";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");
let accessToken: string | null = null;
let activeRefresh: Promise<AuthPayload> | null = null;

export class ApiClientError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = "ApiClientError";
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function assetUrl(path: string | null | undefined) { return path ? `${API_ORIGIN}${path}` : null; }

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const body = await response.json() as ApiEnvelope<T> | ApiErrorBody;
  if (!response.ok || !body.success) {
    const error = body as ApiErrorBody;
    throw new ApiClientError(error.message ?? "No se pudo completar la operación.", response.status, error.code);
  }
  return body.data;
}

export async function refreshSession(): Promise<AuthPayload> {
  if (!activeRefresh) {
    activeRefresh = fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" })
      .then((response) => parseResponse<AuthPayload>(response))
      .then((data) => { setAccessToken(data.accessToken); return data; })
      .finally(() => { activeRefresh = null; });
  }
  return activeRefresh;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, retryAuth = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });
  if (response.status === 401 && retryAuth && path !== "/auth/refresh") {
    try {
      await refreshSession();
      return apiRequest<T>(path, init, false);
    } catch {
      setAccessToken(null);
    }
  }
  return parseResponse<T>(response);
}

export async function loginRequest(identifier: string, password: string) {
  const data = await apiRequest<AuthPayload>("/auth/login", { method: "POST", body: JSON.stringify({ identifier, password }) }, false);
  setAccessToken(data.accessToken);
  return data;
}

export async function logoutRequest() {
  try { await apiRequest<void>("/auth/logout", { method: "POST" }, false); }
  finally { setAccessToken(null); }
}
