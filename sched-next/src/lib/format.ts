// All wall-clock display is America/New_York; storage is UTC.
const TZ = "America/New_York";

export function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
}

export function fmtDay(d: Date): string {
  return d.toLocaleDateString("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export function fmtDayShort(d: Date): string {
  return d.toLocaleDateString("en-US", { timeZone: TZ, month: "short", day: "numeric", year: "numeric" });
}

export function fmtDateRange(a: Date, b: Date): string {
  const opts = { timeZone: TZ, month: "long", day: "numeric" } as const;
  const start = a.toLocaleDateString("en-US", opts);
  const end = b.toLocaleDateString("en-US", { ...opts, year: "numeric" });
  return `${start}–${end}`;
}

export function fmtUnits(n: number): string {
  // Credit figures always show two decimals: 1.50, 0.75. Ledger discipline.
  return n.toFixed(2);
}

export function yearOf(d: Date): number {
  return Number(d.toLocaleDateString("en-US", { timeZone: TZ, year: "numeric" }));
}
