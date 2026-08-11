import type { SessionUser } from "./auth.js";

declare global {
  namespace Express {
    interface Request {
      auth?: SessionUser;
    }
  }
}

export {};
