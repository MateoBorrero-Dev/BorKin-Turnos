import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClientAppointmentHistory } from "../types/api";
import { ClientHistory } from "./ClientDetailPage";

afterEach(cleanup);
const empty: ClientAppointmentHistory = { items: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 }, summary: { appointmentCount: 0, completedCount: 0, lastVisit: null, nextAppointment: null } };

describe("historial real del cliente", () => {
  it("muestra un empty state vigente sin prometer una agenda futura", () => { render(<ClientHistory data={empty} loading={false} error={null} timeZone="America/Argentina/Cordoba" onPrevious={vi.fn()} onNext={vi.fn()} />); expect(screen.getByText("Este cliente todavía no tiene turnos registrados.")).toBeTruthy(); expect(screen.queryByText(/cuando se implemente la agenda/i)).toBeNull(); });
  it("renderiza snapshots, profesional, precio y estados visibles", () => { const data: ClientAppointmentHistory = { items: [{ id: "a", startAt: "2026-08-12T13:00:00.000Z", endAt: "2026-08-12T13:45:00.000Z", serviceName: "Corte snapshot", price: "15000", status: "COMPLETADO", employee: { id: "e", firstName: "Juan", lastName: "Pérez" } }, { id: "b", startAt: "2026-08-11T13:00:00.000Z", endAt: "2026-08-11T13:30:00.000Z", serviceName: "Barba snapshot", price: "9000", status: "CANCELADO", employee: { id: "e", firstName: "Juan", lastName: "Pérez" } }], meta: { page: 1, pageSize: 10, total: 2, totalPages: 1 }, summary: { appointmentCount: 2, completedCount: 1, lastVisit: { id: "a", startAt: "2026-08-12T13:00:00.000Z" }, nextAppointment: null } }; render(<ClientHistory data={data} loading={false} error={null} timeZone="America/Argentina/Cordoba" onPrevious={vi.fn()} onNext={vi.fn()} />); expect(screen.getByText("Corte snapshot")).toBeTruthy(); expect(screen.getByText("Barba snapshot")).toBeTruthy(); expect(screen.getByText("Completado")).toBeTruthy(); expect(screen.getByText("Cancelado")).toBeTruthy(); expect(screen.getAllByText(/Juan Pérez/)).toHaveLength(2); expect(screen.getByText("$15.000")).toBeTruthy(); });
});
