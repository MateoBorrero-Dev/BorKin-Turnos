import type { ScheduleInterval } from "../types/api";

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

export function validateScheduleIntervals(intervals: ScheduleInterval[]) {
  const sorted = [...intervals].sort((a, b) => a.dayOfWeek - b.dayOfWeek || minutes(a.startTime) - minutes(b.startTime));
  for (let index = 0; index < sorted.length; index += 1) {
    const item = sorted[index]!;
    if (minutes(item.startTime) >= minutes(item.endTime)) return "La hora de inicio debe ser anterior a la hora de fin.";
    const previous = sorted[index - 1];
    if (previous && previous.dayOfWeek === item.dayOfWeek && minutes(previous.endTime) > minutes(item.startTime)) return "El horario se superpone con otro intervalo laboral.";
  }
  return null;
}
