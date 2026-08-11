import { describe, expect, it } from "vitest";
import { validateScheduleIntervals } from "./schedules";

describe("validación de horarios", () => {
  it("acepta intervalos adyacentes y separados", () => expect(validateScheduleIntervals([{ dayOfWeek: 1, startTime: "09:00", endTime: "13:00" }, { dayOfWeek: 1, startTime: "13:00", endTime: "18:00" }])).toBeNull());
  it("rechaza solapamientos", () => expect(validateScheduleIntervals([{ dayOfWeek: 1, startTime: "09:00", endTime: "14:00" }, { dayOfWeek: 1, startTime: "13:00", endTime: "18:00" }])).toContain("superpone"));
  it("rechaza inicio igual o posterior al fin", () => expect(validateScheduleIntervals([{ dayOfWeek: 2, startTime: "10:00", endTime: "10:00" }])).toContain("anterior"));
});
