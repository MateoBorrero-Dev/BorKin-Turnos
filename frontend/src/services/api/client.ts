import type { ApiEnvelope, ApiErrorBody, AuthPayload } from "../../types/api";

export function resolveApiUrl(configured: string | undefined, fallback: string) {
  return configured ?? fallback;
}

const API_URL = resolveApiUrl(import.meta.env.VITE_API_URL, import.meta.env.DEV ? "http://localhost:3000/api" : "/api");
const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");
let accessToken: string | null = null;
let activeRefresh: Promise<AuthPayload> | null = null;
let sessionExpirationNotified = false;
const sessionExpirationListeners = new Set<() => void>();

const safeMessages: Record<string, string> = {
  APPOINTMENT_ALREADY_PAID: "El turno ya fue cobrado y no puede modificarse como un turno normal.",
  APPOINTMENT_CONFLICT: "El horario se superpone con otro turno o bloqueo.",
  CASH_ALREADY_OPEN: "Ya existe una caja abierta.",
  CASH_NOT_OPEN: "Primero debe abrirse la caja.",
  FORBIDDEN: "No tenés permiso para realizar esta acción.",
  INTERNAL_ERROR: "Ocurrió un error inesperado. Intentá nuevamente.",
  RATE_LIMITED: "Se realizaron demasiados intentos. Esperá unos minutos.",
  SERVICE_UNAVAILABLE: "El servicio no está disponible en este momento.",
  VALIDATION_ERROR: "Revisá los datos ingresados e intentá nuevamente.",
};

export class ApiClientError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string, public readonly details?: unknown) {
    super(message);
    this.name = "ApiClientError";
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) sessionExpirationNotified = false;
}

export function assetUrl(path: string | null | undefined) { return path ? `${API_ORIGIN}${path}` : null; }

export function subscribeSessionExpired(listener: () => void) {
  sessionExpirationListeners.add(listener);
  return () => { sessionExpirationListeners.delete(listener); };
}

function notifySessionExpired() {
  if (sessionExpirationNotified) return;
  sessionExpirationNotified = true;
  sessionExpirationListeners.forEach((listener) => listener());
}

async function safeFetch(input: RequestInfo | URL, init?: RequestInit) {
  try {
    return await fetch(input, init);
  } catch {
    throw new ApiClientError("No pudimos conectar con el servidor. Verificá tu conexión e intentá nuevamente.", 0, "NETWORK_ERROR");
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  let body: ApiEnvelope<T> | ApiErrorBody;
  try {
    body = await response.json() as ApiEnvelope<T> | ApiErrorBody;
  } catch {
    throw new ApiClientError(
      response.ok ? "El servidor devolvió una respuesta inválida." : "No se pudo completar la operación.",
      response.status,
      "INVALID_RESPONSE",
    );
  }
  if (!response.ok || !body.success) {
    const error = body as ApiErrorBody;
    const message = error.code && safeMessages[error.code] ? safeMessages[error.code] : error.message;
    throw new ApiClientError(message || "No se pudo completar la operación.", response.status, error.code, error.details);
  }
  return body.data;
}

export async function refreshSession(): Promise<AuthPayload> {
  if (!activeRefresh) {
    activeRefresh = safeFetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" })
      .then((response) => parseResponse<AuthPayload>(response))
      .then((data) => { setAccessToken(data.accessToken); return data; })
      .finally(() => { activeRefresh = null; });
  }
  return activeRefresh;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, retryAuth = true): Promise<T> {
  const headers = new Headers(init.headers);
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (init.body && !isFormData && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  const response = await safeFetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });
  if (response.status === 401 && retryAuth && path !== "/auth/refresh") {
    try {
      await refreshSession();
      return apiRequest<T>(path, init, false);
    } catch (error) {
      setAccessToken(null);
      notifySessionExpired();
      throw error;
    }
  }
  return parseResponse<T>(response);
}

export async function apiDownload(path: string, retryAuth = true): Promise<{ blob: Blob; filename: string }> {
  const headers = new Headers();
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  const response = await safeFetch(`${API_URL}${path}`, { headers, credentials: "include" });
  if (response.status === 401 && retryAuth) {
    try { await refreshSession(); return apiDownload(path, false); }
    catch (error) { setAccessToken(null); notifySessionExpired(); throw error; }
  }
  if (!response.ok) {
    let message = "No se pudo exportar el reporte.";
    try { const body = await response.json() as ApiErrorBody; message = body.message ?? message; } catch { /* CSV/error sin JSON */ }
    throw new ApiClientError(message, response.status);
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return { blob: await response.blob(), filename: match?.[1] ?? "reporte.csv" };
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
