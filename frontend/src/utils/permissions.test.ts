import { describe, expect, it } from "vitest";
import { hasPermission } from "./permissions";

describe("hasPermission", () => {
  it("sólo concede permisos presentes en la sesión", () => {
    expect(hasPermission(["dashboard.view", "users.manage"], "users.manage")).toBe(true);
    expect(hasPermission(["dashboard.view"], "users.manage")).toBe(false);
  });
});
