import { describe, expect, it } from "vitest";
import { serviceFormSchema } from "./service-form";

const valid = { name: "Corte", categoryId: "", description: "", price: "15000.00", durationMinutes: 45, color: "#2563EB" };

describe("formulario de servicios", () => {
  it("acepta precisión monetaria de dos decimales", () => expect(serviceFormSchema.safeParse(valid).success).toBe(true));
  it("rechaza precios con precisión excesiva", () => expect(serviceFormSchema.safeParse({ ...valid, price: "10.999" }).success).toBe(false));
  it("rechaza duración no positiva", () => expect(serviceFormSchema.safeParse({ ...valid, durationMinutes: 0 }).success).toBe(false));
});
