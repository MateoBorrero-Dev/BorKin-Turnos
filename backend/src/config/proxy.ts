import type { Express, Request } from "express";
import { ipKeyGenerator } from "express-rate-limit";

export function configureProxyTrust(app: Express, trustedHops: number) {
  app.set("trust proxy", trustedHops > 0 ? trustedHops : false);
}

export function clientIpRateLimitKey(request: Request) {
  return ipKeyGenerator(request.ip ?? request.socket.remoteAddress ?? "unknown");
}
