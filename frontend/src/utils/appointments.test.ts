import { describe, expect, it } from "vitest";
import { ApiClientError } from "../services/api/client";
import { agendaPath, appointmentError, availabilityTimes, calendarRange, clearAfterEmployeeOrDateChange, clearAfterServiceChange, clientOptionsPath, intervalIntersectsLocalDay, navigateAnchor, selectableAvailabilitySlots, statusActions, todayKeyInZone } from "./appointments";

describe("agenda y formulario de turnos", () => {
  it("calcula rangos funcionales para día, semana y mes", () => { expect(calendarRange("day", "2026-08-11").days).toEqual(["2026-08-11"]); expect(calendarRange("week", "2026-08-11")).toMatchObject({ from: "2026-08-10", to: "2026-08-16" }); expect(calendarRange("month", "2026-08-11").days.length).toBe(42); expect(navigateAnchor("month", "2026-08-11", 1)).toBe("2026-09-01"); });
  it("limpia profesional y slot al cambiar servicio", () => expect(clearAfterServiceChange()).toEqual({ employeeId: "", time: "" }));
  it("limpia sólo el slot al cambiar profesional o fecha", () => expect(clearAfterEmployeeOrDateChange()).toEqual({ time: "" }));
  it("presenta únicamente slots calculados por backend", () => expect(availabilityTimes({ date: "2026-08-11", timezone: "America/Argentina/Cordoba", durationMinutes: 45, slotMinutes: 15, slots: [{ date: "2026-08-11", time: "09:15", startAt: "x", endAt: "y", durationMinutes: 45 }] })).toEqual(["09:15"]));
  it("oculta defensivamente slots pasados de hoy sin usar el timezone del navegador", () => {
    const now = new Date("2026-08-17T13:07:00.000Z");
    const value = { date: "2026-08-17", timezone: "America/Argentina/Cordoba", durationMinutes: 45, slotMinutes: 15, slots: [{ date: "2026-08-17", time: "10:00", startAt: "2026-08-17T13:00:00.000Z", endAt: "2026-08-17T13:45:00.000Z", durationMinutes: 45 }, { date: "2026-08-17", time: "10:15", startAt: "2026-08-17T13:15:00.000Z", endAt: "2026-08-17T14:00:00.000Z", durationMinutes: 45 }] };
    expect(selectableAvailabilitySlots(value, "2026-08-17", "America/Argentina/Cordoba", now).map((slot) => slot.time)).toEqual(["10:15"]);
  });
  it("traduce un 409 de carrera a una acción clara", () => expect(appointmentError(new ApiClientError("conflict", 409, "APPOINTMENT_CONFLICT"))).toContain("acaba de ocuparse"));
  it("habilita botones sólo para transiciones operativas; completar requiere cobro", () => { expect(statusActions("PENDIENTE")).toEqual(["confirm", "start", "cancel", "no-show"]); expect(statusActions("EN_CURSO")).toEqual([]); expect(statusActions("COMPLETADO")).toEqual([]); });
  it("construye el filtro de profesional sin hardcodear datos", () => expect(agendaPath("2026-08-10", "2026-08-16", "pro 1")).toBe("/appointments?from=2026-08-10&to=2026-08-16&employeeId=pro%201"));
  it("construye la búsqueda remota de clientes escapando el texto", () => expect(clientOptionsPath(" maría +54 ")).toBe("/clients/options?search=mar%C3%ADa%20%2B54&limit=8"));
  it("muestra FULL_DAY sólo en su único día con semántica [)", () => { const start = "2026-08-11T03:00:00.000Z"; const end = "2026-08-12T03:00:00.000Z"; expect(intervalIntersectsLocalDay(start, end, "2026-08-11", "America/Argentina/Cordoba")).toBe(true); expect(intervalIntersectsLocalDay(start, end, "2026-08-12", "America/Argentina/Cordoba")).toBe(false); });
  it("muestra DATE_RANGE exactamente en sus tres días", () => { const start = "2026-08-11T03:00:00.000Z"; const end = "2026-08-14T03:00:00.000Z"; expect(["2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14"].map((day) => intervalIntersectsLocalDay(start, end, day, "America/Argentina/Cordoba"))).toEqual([true, true, true, false]); });
  it("muestra un INTERVAL únicamente el día que intersecta", () => { const start = "2026-08-11T16:00:00.000Z"; const end = "2026-08-11T18:00:00.000Z"; expect(intervalIntersectsLocalDay(start, end, "2026-08-11", "America/Argentina/Cordoba")).toBe(true); expect(intervalIntersectsLocalDay(start, end, "2026-08-12", "America/Argentina/Cordoba")).toBe(false); });
  it("calcula Hoy con la timezone IANA del negocio y no con UTC", () => { const instant = new Date("2026-08-12T01:30:00.000Z"); expect(todayKeyInZone("America/Argentina/Cordoba", instant)).toBe("2026-08-11"); expect(todayKeyInZone("Asia/Tokyo", new Date("2026-08-11T18:30:00.000Z"))).toBe("2026-08-12"); });
});
