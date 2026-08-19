import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PermissionRoute } from "./ProtectedRoutes";

vi.mock("../../hooks/useAuth", () => ({ useAuth: () => ({ user: { permissions: [] }, loading: false }) }));

describe("rutas con permisos", () => {
  it("muestra una página 403 en vez de redirigir silenciosamente", () => {
    render(<MemoryRouter initialEntries={["/restricted"]}><Routes><Route element={<PermissionRoute permission="cash.view" />}><Route path="restricted" element={<p>Privado</p>} /></Route></Routes></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Acceso restringido" })).toBeTruthy();
    expect(screen.queryByText("Privado")).toBeNull();
  });
});
