import { describe, expect, it } from "vitest";
import { ApiClientError } from "../services/api/client";
import { clientFormSchema, clientPayload, clientsPath, duplicateClients } from "./client-form";

describe("cliente: formulario y contrato API", () => {
  it("acepta un cliente mínimo sin inventar datos", () => {
    const result = clientFormSchema.safeParse({ firstName: "Juan", lastName: "", phone: "", email: "", birthDate: "", notes: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(clientPayload(result.data)).toEqual({ firstName: "Juan", lastName: null, phone: null, email: null, birthDate: null, notes: null });
  });

  it("normaliza presentación del payload completo", () => {
    const values = { firstName: " Ana ", lastName: " López ", phone: "+54 9 351-1234", email: " ANA@EXAMPLE.COM ", birthDate: "1990-08-15", notes: " Tarde " };
    const parsed = clientFormSchema.parse(values);
    expect(clientPayload(parsed)).toMatchObject({ firstName: "Ana", lastName: "López", email: "ana@example.com", birthDate: "1990-08-15" });
  });

  it("rechaza email, fecha futura y notas excesivas", () => {
    const base = { firstName: "Ana", lastName: "", phone: "", email: "", birthDate: "", notes: "" };
    expect(clientFormSchema.safeParse({ ...base, email: "mal" }).success).toBe(false);
    expect(clientFormSchema.safeParse({ ...base, birthDate: "2999-01-01" }).success).toBe(false);
    expect(clientFormSchema.safeParse({ ...base, notes: "x".repeat(2_001) }).success).toBe(false);
  });

  it("interpreta sólo la respuesta estructurada de duplicados", () => {
    const match = { id: "1", fullName: "Juan Pérez", phone: "123", email: null, reasons: ["phone" as const] };
    expect(duplicateClients(new ApiClientError("Duplicado", 409, "POSSIBLE_DUPLICATE", { matches: [match] }))).toEqual([match]);
    expect(duplicateClients(new Error("otro"))).toBeNull();
    expect(clientPayload({ firstName: "Juan", lastName: "", phone: "123", email: "", birthDate: "", notes: "" }, true)).toHaveProperty("forceDuplicate", true);
  });

  it("construye búsqueda paginada y filtro para el backend", () => {
    expect(clientsPath(2, 50, " juan perez ", "inactive")).toBe("/clients?page=2&pageSize=50&status=inactive&search=juan+perez");
  });
});
