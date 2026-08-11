import "dotenv/config";

const baseUrl = `http://127.0.0.1:${process.env.PORT ?? 3000}/api`;

async function json(response) {
  const body = response.status === 204 ? undefined : await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${body?.message ?? "request failed"}`);
  return body?.data;
}

const health = await json(await fetch(`${baseUrl}/health`));
const loginResponse = await fetch(`${baseUrl}/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json", "user-agent": "BorKin runtime verification" },
  body: JSON.stringify({ identifier: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD }),
});
const refreshCookie = loginResponse.headers.get("set-cookie")?.split(";")[0];
const login = await json(loginResponse);
if (!refreshCookie) throw new Error("Login did not return a refresh cookie");

const me = await json(await fetch(`${baseUrl}/auth/me`, { headers: { authorization: `Bearer ${login.accessToken}` } }));
const refresh = await json(await fetch(`${baseUrl}/auth/refresh`, { method: "POST", headers: { cookie: refreshCookie, origin: process.env.FRONTEND_URL } }));
const users = await json(await fetch(`${baseUrl}/users`, { headers: { authorization: `Bearer ${refresh.accessToken}` } }));
const rotatedCookieResponse = await fetch(`${baseUrl}/auth/refresh`, { method: "POST", headers: { cookie: refreshCookie, origin: process.env.FRONTEND_URL } });

const freshLoginResponse = await fetch(`${baseUrl}/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ identifier: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD }),
});
const logoutCookie = freshLoginResponse.headers.get("set-cookie")?.split(";")[0];
await json(freshLoginResponse);
if (!logoutCookie) throw new Error("Second login did not return a refresh cookie");
const logoutResponse = await fetch(`${baseUrl}/auth/logout`, { method: "POST", headers: { cookie: logoutCookie, origin: process.env.FRONTEND_URL } });
const afterLogout = await fetch(`${baseUrl}/auth/refresh`, { method: "POST", headers: { cookie: logoutCookie, origin: process.env.FRONTEND_URL } });

console.info(JSON.stringify({
  health: health.status === "ok" && health.database === "connected",
  login: me.username === process.env.ADMIN_USERNAME,
  protectedRoute: Array.isArray(users),
  refresh: typeof refresh.accessToken === "string",
  reuseRejected: rotatedCookieResponse.status === 401,
  logout: logoutResponse.status === 204,
  logoutInvalidated: afterLogout.status === 401,
  persistedUsers: users.length,
}));
