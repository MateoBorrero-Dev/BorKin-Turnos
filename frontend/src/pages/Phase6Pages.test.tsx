import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../features/auth/auth-context";
import { apiRequest } from "../services/api/client";
import type { AuthUser } from "../types/api";
import { AuditPage } from "./AuditPage";
import { DashboardPage } from "./DashboardPage";
import { ReportsPage } from "./ReportsPage";
import { StatisticsPage } from "./StatisticsPage";

vi.mock("../services/api/client", () => ({ apiRequest: vi.fn(), apiDownload: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const user: AuthUser = { id: "u", businessId: "b", username: "admin", email: "a@test", firstName: "Mateo", lastName: "Test", role: { id: "r", code: "ADMIN", name: "Admin" }, permissions: ["dashboard.view","statistics.view","reports.view","audit.view"], business: { id: "b", name: "BorKin", locale: "es-AR", currency: "ARS", timezone: "America/Argentina/Cordoba", primaryColor: "#2563EB" } };
function Providers({ children }: { children: React.ReactNode }) { return <MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AuthContext.Provider value={{ user, loading: false, login: vi.fn(), logout: vi.fn(), refreshUser: vi.fn() }}>{children}</AuthContext.Provider></QueryClientProvider></MemoryRouter>; }

describe("Fase 6 frontend", () => {
  it("muestra dashboard real con KPIs, cobros y próximo turno", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ date: "2026-08-15", timezone: user.business.timezone, kpis: { total: 4, pending: 1, confirmed: 1, inProgress: 0, completed: 2, cancelled: 0, absent: 0, clientsAttended: 2 }, financial: { sales: "12500.00", paymentCount: 2, averageTicket: "6250.00" }, appointments: [], nextAppointment: { id: "a", startAt: "2026-08-15T15:00:00Z", status: "CONFIRMADO", serviceName: "Corte", client: { firstName: "Ana", lastName: "Paz" }, employee: { firstName: "Pro", lastName: "Uno" } } });
    render(<Providers><DashboardPage /></Providers>); expect(await screen.findByText("Turnos de hoy")).toBeTruthy(); expect(screen.getByText("Ventas cobradas")).toBeTruthy(); expect(screen.getByText("Ana Paz")).toBeTruthy();
  });
  it("renderiza comparaciones y los cuatro análisis visuales", async () => {
    vi.mocked(apiRequest).mockImplementation(async (path) => String(path).includes("/options") ? { employees: [], services: [], paymentMethods: [] } : String(path).includes("/overview") ? { period: { from: "2026-08-01", to: "2026-08-15", timezone: user.business.timezone, previousFrom: "2026-07-17", previousTo: "2026-07-31" }, current: { sales: "1000.00", paymentCount: 2, averageTicket: "500.00", appointmentCount: 3, completedCount: 2, clientCount: 2, newClientCount: 1, cancelledCount: 1, absentCount: 0, cancellationRate: "33.3" }, previous: { sales: "500.00", appointmentCount: 2, clientCount: 1 }, comparison: { sales: "100.0", appointments: "50.0", clients: "100.0" } } : String(path).includes("/timeseries") ? { timezone: user.business.timezone, points: [{ date: "2026-08-01", sales: "1000.00", appointments: 3 }] } : { services: [{ id: "s", name: "Corte", sales: "1000.00", count: 2 }], employees: [{ id: "e", name: "Pro Uno", sales: "1000.00", count: 2 }], paymentMethods: [{ id: "m", name: "Efectivo", kind: "CASH", sales: "1000.00", count: 2, percentage: "100.0" }] });
    render(<Providers><StatisticsPage /></Providers>); expect(await screen.findByText("Ventas por día")).toBeTruthy(); expect(screen.getByText("Turnos por día")).toBeTruthy(); expect(screen.getByText("Servicios con más ventas")).toBeTruthy(); expect(screen.getByText("Métodos de pago")).toBeTruthy();
  });
  it("muestra reporte paginado con filtros aplicados en backend", async () => {
    vi.mocked(apiRequest).mockImplementation(async (path) => String(path).includes("/options") ? { employees: [], services: [], paymentMethods: [] } : { timezone: user.business.timezone, meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 }, items: [{ id: "p", createdAt: "2026-08-15T12:00:00Z", amount: "8500.00", originalPrice: "10000.00", clientName: "Ana Paz", employeeName: "Pro Uno", recordedByName: "Admin BorKin", paymentMethod: { id: "m", name: "Efectivo", kind: "CASH" }, appointment: { id: "a", serviceName: "Corte" } }] });
    render(<Providers><ReportsPage /></Providers>); expect(await screen.findAllByText("Ana Paz")).toHaveLength(2); expect(screen.getAllByText("Efectivo").length).toBeGreaterThan(0); expect(screen.getAllByText("Precio original").length).toBeGreaterThan(0); expect(screen.getAllByText("Monto cobrado").length).toBeGreaterThan(0); expect(screen.getAllByText("Admin BorKin").length).toBeGreaterThan(0); expect(screen.getByText(/1 resultados/)).toBeTruthy();
  });
  it("distingue en Turnos el precio histórico de la ausencia de Payment", async () => {
    vi.mocked(apiRequest).mockImplementation(async (path) => String(path).includes("/options") ? { employees: [], services: [], paymentMethods: [] } : String(path).includes("/appointments?") ? { timezone: user.business.timezone, meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 }, items: [{ id: "a", startAt: "2026-08-15T12:00:00Z", status: "COMPLETADO", serviceName: "Corte histórico", price: "10000.00", paidAmount: null, clientName: "Ana Paz", employeeName: "Pro Uno" }] } : { timezone: user.business.timezone, meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 }, items: [] });
    render(<Providers><ReportsPage /></Providers>); fireEvent.click(screen.getByRole("button", { name: "Turnos" })); expect(await screen.findAllByText("Corte histórico")).toHaveLength(2); expect(screen.getAllByText("Precio histórico").length).toBeGreaterThan(0); expect(screen.getAllByText("Monto cobrado").length).toBeGreaterThan(0); expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
  it("presenta auditoría con metadata protegida", async () => {
    vi.mocked(apiRequest).mockImplementation(async (path) => String(path).includes("/options") ? { users: [], actions: ["PAYMENT_CREATED"], entities: ["Payment"] } : { timezone: user.business.timezone, meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 }, items: [{ id: "l", action: "PAYMENT_CREATED", entity: "Payment", entityId: "p", metadata: { token: "[PROTEGIDO]" }, ipAddress: "127.0.0.1", createdAt: "2026-08-15T12:00:00Z", user: { id: "u", firstName: "Mateo", lastName: "Test", username: "admin" } }] });
    render(<Providers><AuditPage /></Providers>); expect((await screen.findAllByText("Cobro registrado")).length).toBeGreaterThan(0); expect(screen.getByText("Mateo Test")).toBeTruthy(); expect(screen.getByText("Ver contexto protegido")).toBeTruthy();
  });
});
