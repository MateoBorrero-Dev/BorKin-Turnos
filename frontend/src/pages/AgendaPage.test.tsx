import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppointmentReasonModal } from "./AgendaPage";

afterEach(cleanup);

describe("modal de cancelación", () => {
  it("exige motivo y permite confirmar al completarlo", () => { const confirm = vi.fn(); const reason = vi.fn(); const { rerender } = render(<AppointmentReasonModal action="cancel" reason="" pending={false} onReason={reason} onClose={vi.fn()} onConfirm={confirm} />); expect((screen.getByRole("button", { name: "Confirmar" }) as HTMLButtonElement).disabled).toBe(true); fireEvent.change(screen.getByRole("textbox", { name: "Motivo" }), { target: { value: "Cliente avisó" } }); expect(reason).toHaveBeenCalledWith("Cliente avisó"); rerender(<AppointmentReasonModal action="cancel" reason="Cliente avisó" pending={false} onReason={reason} onClose={vi.fn()} onConfirm={confirm} />); fireEvent.click(screen.getByRole("button", { name: "Confirmar" })); expect(confirm).toHaveBeenCalledOnce(); });
});
