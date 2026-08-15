const FORMULA = /^\s*[=+\-@]/;

export type CsvValue = string | number | null | undefined | Date | { numeric: string };

function cell(value: CsvValue) {
  if (value === null || value === undefined) return '""';
  if (typeof value === "object" && "numeric" in value) return value.numeric;
  const raw = value instanceof Date ? value.toISOString() : String(value);
  const safe = FORMULA.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function csv(headers: string[], rows: CsvValue[][]) {
  return `\uFEFF${[headers, ...rows].map((row) => row.map(cell).join(";")).join("\r\n")}\r\n`;
}

export function csvFilename(report: string, from: string, to: string) {
  return `borkin-${report}-${from}-a-${to}.csv`;
}
