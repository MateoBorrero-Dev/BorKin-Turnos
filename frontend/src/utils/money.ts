export function moneyToCents(value: string) {
  const match = value.trim().match(/^(\d{1,12})(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  return BigInt(match[1]!) * 100n + BigInt((match[2] ?? "").padEnd(2, "0") || "0");
}

export function validMoney(value: string, allowZero = false) {
  const cents = moneyToCents(value);
  return cents !== null && (allowZero ? cents >= 0n : cents > 0n);
}

export function equalMoney(left: string, right: string) {
  const leftCents = moneyToCents(left); const rightCents = moneyToCents(right);
  return leftCents !== null && rightCents !== null && leftCents === rightCents;
}

export function subtractMoney(left: string, right: string) {
  const cents = (moneyToCents(left) ?? 0n) - (moneyToCents(right) ?? 0n);
  const sign = cents < 0n ? "-" : ""; const absolute = cents < 0n ? -cents : cents;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

export function formatMoney(value: string, currency = "ARS", locale = "es-AR") {
  const cents = moneyToCents(value.replace(/^-/, ""));
  if (cents === null) return value;
  const negative = value.startsWith("-"); const whole = cents / 100n; const fraction = String(cents % 100n).padStart(2, "0");
  const formatter = new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const parts = formatter.formatToParts(negative ? (whole === 0n ? -1n : -whole) : whole);
  return parts.map((part) => part.type === "fraction" ? fraction : negative && whole === 0n && part.type === "integer" ? "0" : part.value).join("");
}
