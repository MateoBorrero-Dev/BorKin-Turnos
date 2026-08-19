import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

describe("Modal accesible", () => {
  it("expone semántica de diálogo, enfoca una acción y cierra con Escape", () => {
    const onClose = vi.fn();
    render(<Modal title="Confirmar operación" onClose={onClose}><button>Continuar</button></Modal>);
    const dialog = screen.getByRole("dialog", { name: "Confirmar operación" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cerrar" }));
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
