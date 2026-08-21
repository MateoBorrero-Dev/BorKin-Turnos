import { loadEnvironmentFile, parseArgs } from "../database/backup-utils.mjs";

const args = parseArgs(process.argv.slice(2));
await loadEnvironmentFile(args);
const origin = (args.origin ?? process.env.SMOKE_ORIGIN ?? "http://127.0.0.1:8080").replace(/\/$/, "");
const api = `${origin}/api`;
const trustedOrigin = process.env.FRONTEND_URL ?? origin;
const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;
if (!username || !password) throw new Error("ADMIN_USERNAME y ADMIN_PASSWORD son obligatorios.");

let accessToken;
let refreshCookie;

async function request(path, options = {}) {
  const headers = new Headers(options.headers);
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  if (options.cookie && refreshCookie) headers.set("cookie", refreshCookie);
  if (options.body && !(options.body instanceof FormData)) headers.set("content-type", "application/json");
  const response = await fetch(`${api}${path}`, { ...options, headers });
  const cookie = response.headers.getSetCookie?.()[0] ?? response.headers.get("set-cookie");
  if (cookie) refreshCookie = cookie.split(";", 1)[0];
  if (response.status === 204) return { status: response.status };
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) throw new Error(`${options.method ?? "GET"} ${path}: ${response.status} ${payload?.code ?? "INVALID_RESPONSE"}`);
  return { status: response.status, ...payload };
}

const body = (value) => JSON.stringify(value);
const login = await request("/auth/login", { method: "POST", body: body({ identifier: username, password }) });
accessToken = login.data.accessToken;
if (login.data.user.role.code !== "ADMIN" || login.data.user.permissions.length < 1) throw new Error("El administrador no recibió rol/permisos.");
await request("/auth/me");

const suffix = Date.now().toString(36);
await request("/settings/business", { method: "PATCH", body: body({ name: `BorKin QA ${suffix}`, timezone: "America/Argentina/Cordoba", currency: "ARS" }) });
const category = await request("/service-categories", { method: "POST", body: body({ name: `QA Categoría ${suffix}` }) });
const service = await request("/services", {
  method: "POST",
  body: body({ name: `QA Servicio ${suffix}`, categoryId: category.data.id, price: "15000.00", durationMinutes: 45, color: "#2563EB" }),
});
const employee = await request("/employees", {
  method: "POST",
  body: body({ firstName: "Profesional", lastName: `QA ${suffix}`, email: `profesional.${suffix}@qa.local`, color: "#0F766E" }),
});
await request(`/employees/${employee.data.id}/services`, { method: "PUT", body: body({ serviceIds: [service.data.id] }) });

const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
const date = tomorrow.toISOString().slice(0, 10);
await request(`/employees/${employee.data.id}/schedules`, {
  method: "PUT",
  body: body({ intervals: [{ dayOfWeek: tomorrow.getUTCDay(), startTime: "09:00", endTime: "18:00" }] }),
});
const client = await request("/clients", {
  method: "POST",
  body: body({ firstName: "Cliente", lastName: `QA ${suffix}`, phone: `+54 9 351 55${String(Date.now()).slice(-5)}`, email: `cliente.${suffix}@qa.local` }),
});
const appointment = await request("/appointments", {
  method: "POST",
  body: body({ clientId: client.data.id, serviceId: service.data.id, employeeId: employee.data.id, date, time: "10:00", notes: "Smoke comercial Fase 8" }),
});
await request(`/appointments/${appointment.data.id}/confirm`, { method: "POST" });
await request(`/appointments/${appointment.data.id}/start`, { method: "POST" });

const existingCash = await request("/cash/current");
if (!existingCash.data) await request("/cash/open", { method: "POST", body: body({ openingAmount: "1000.00", notes: "Smoke Fase 8" }) });
const methods = await request("/payment-methods/options");
const cashMethod = methods.data.find((method) => method.kind === "CASH");
if (!cashMethod) throw new Error("No existe método de pago efectivo.");
const charged = await request(`/appointments/${appointment.data.id}/charge`, {
  method: "POST",
  body: body({ paymentMethodId: cashMethod.id, amount: "15000.00" }),
});
if (charged.data.status !== "COMPLETADO" || charged.data.payments.length !== 1) throw new Error("El cobro no completó el turno de forma atómica.");
await request("/analytics/dashboard");

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const logoForm = new FormData();
logoForm.set("logo", new Blob([png], { type: "image/png" }), "qa.png");
const logo = await request("/settings/business/logo", { method: "PUT", body: logoForm });
const photoForm = new FormData();
photoForm.set("photo", new Blob([png], { type: "image/png" }), "qa.png");
const photo = await request(`/employees/${employee.data.id}/photo`, { method: "PUT", body: photoForm });
for (const asset of [logo.data.logoUrl, photo.data.photoUrl]) {
  const response = await fetch(`${origin}${asset}`);
  if (!response.ok || response.headers.get("content-type") !== "image/png") throw new Error(`Asset no disponible: ${asset}`);
  if (response.headers.get("cross-origin-resource-policy") === "same-origin") throw new Error(`CORP incompatible en ${asset}`);
}

const currentCash = await request("/cash/current");
await request("/cash/close", { method: "POST", body: body({ countedCash: currentCash.data.totals.expectedCash, notes: "Cierre smoke Fase 8" }) });
const refreshed = await request("/auth/refresh", { method: "POST", cookie: true, headers: { origin: trustedOrigin } });
accessToken = refreshed.data.accessToken;
await request("/clients?page=1&pageSize=1");
await request("/auth/logout", { method: "POST", cookie: true, headers: { origin: trustedOrigin } });

console.info(JSON.stringify({
  origin,
  login: true,
  protectedRoute: true,
  role: "ADMIN",
  permissions: login.data.user.permissions.length,
  business: true,
  service: true,
  employee: true,
  schedule: true,
  client: true,
  appointment: charged.data.status,
  paymentCount: charged.data.payments.length,
  dashboard: true,
  uploads: 2,
  cashClosed: true,
  refresh: true,
  logout: true,
}));
