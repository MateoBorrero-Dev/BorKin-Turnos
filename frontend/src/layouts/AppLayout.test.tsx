import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "./AppLayout";

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      firstName: "Admin",
      lastName: "Test",
      permissions: ["dashboard.view"],
      role: { name: "Administrador" },
      business: { name: "BorKin Test" },
    },
    logout: vi.fn(),
  }),
}));

function setViewport(desktop: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({ matches: desktop, media: "(min-width: 1024px)", addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  });
}

function renderLayout() {
  return render(<MemoryRouter><Routes><Route element={<AppLayout />}><Route index element={<p>Contenido</p>} /></Route></Routes></MemoryRouter>);
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); Reflect.deleteProperty(window, "matchMedia"); });

describe("drawer responsive", () => {
  it("mantiene inertes y ocultos para accesibilidad los controles mobile mientras está cerrado", () => {
    setViewport(false);
    renderLayout();
    const sidebar = document.getElementById("main-navigation");
    expect(sidebar?.hasAttribute("inert")).toBe(true);
    expect(sidebar?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("link", { name: "Inicio" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    expect(sidebar?.hasAttribute("inert")).toBe(false);
    expect(sidebar?.getAttribute("aria-hidden")).toBe("false");
    expect(screen.getByRole("link", { name: "Inicio" })).toBeTruthy();
  });

  it("mantiene navegable el sidebar cerrado visualmente en desktop", () => {
    setViewport(true);
    renderLayout();
    const sidebar = document.getElementById("main-navigation");
    expect(sidebar?.hasAttribute("inert")).toBe(false);
    expect(sidebar?.getAttribute("aria-hidden")).toBe("false");
    expect(screen.getByRole("link", { name: "Inicio" })).toBeTruthy();
  });
});
