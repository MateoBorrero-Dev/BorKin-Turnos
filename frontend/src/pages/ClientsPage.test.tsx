import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DuplicateClientModal } from "../components/ClientFormModal";
import { hasPermission } from "../utils/permissions";
import { ClientCollection } from "./ClientsPage";

afterEach(cleanup);

describe("clientes: estados, duplicados y permisos", () => {
  it("muestra un estado vacío útil y permite iniciar el alta", () => {
    const onAdd = vi.fn();
    render(<ClientCollection clients={[]} searching={false} onAdd={onAdd} onOpen={vi.fn()} />);
    expect(screen.getByText("Tu negocio todavía no tiene clientes registrados.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Agregar primer cliente" }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("diferencia un resultado de búsqueda vacío", () => {
    render(<ClientCollection clients={[]} searching onAdd={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getByText("No encontramos clientes con esos criterios.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Agregar primer cliente" })).toBeNull();
  });

  it("el modal de duplicados ofrece ver, cancelar y forzar", () => {
    const onView = vi.fn(); const onCancel = vi.fn(); const onForce = vi.fn();
    render(<DuplicateClientModal matches={[{ id: "cliente-1", fullName: "Juan Pérez", phone: "+54 9 351", email: null, reasons: ["phone"] }]} saving={false} onView={onView} onCancel={onCancel} onForce={onForce} />);
    expect(screen.getByText("Juan Pérez")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver cliente" })); expect(onView).toHaveBeenCalledWith("cliente-1");
    fireEvent.click(screen.getByRole("button", { name: "Crear de todas formas" })); expect(onForce).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" })); expect(onCancel).toHaveBeenCalledOnce();
  });

  it("respeta la separación de lectura y administración", () => {
    expect(hasPermission(["clients.view"], "clients.view")).toBe(true);
    expect(hasPermission(["clients.view"], "clients.manage")).toBe(false);
    expect(hasPermission(["clients.view", "clients.manage"], "clients.manage")).toBe(true);
  });
});
