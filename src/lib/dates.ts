export function toDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayIso(): string {
  return toIso(new Date());
}

export function formatBr(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

export function addDaysIso(iso: string, days: number): string {
  const date = toDate(iso);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

export function diffDays(start: string, end: string): number {
  const ms = toDate(end).getTime() - toDate(start).getTime();
  return Math.round(ms / 86_400_000);
}

export function durationFromRange(start: string, end: string): number {
  return Math.max(1, diffDays(start, end));
}

export function endFromDuration(start: string, durationDays: number): string {
  return addDaysIso(start, Math.max(1, durationDays));
}

export function isBefore(a: string, b: string): boolean {
  return a < b;
}

export function clampDate(iso: string, min: string, max: string): string {
  if (iso < min) return min;
  if (iso > max) return max;
  return iso;
}

export function monthLabel(iso: string): string {
  const date = toDate(iso);
  return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function addMonths(iso: string, count: number): string {
  const date = toDate(iso);
  date.setMonth(date.getMonth() + count);
  return toIso(date);
}

export function minIso(dates: string[]): string {
  return dates.reduce((a, b) => (a < b ? a : b));
}

export function maxIso(dates: string[]): string {
  return dates.reduce((a, b) => (a > b ? a : b));
}

export function eachDay(start: string, end: string): string[] {
  const days: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    days.push(cursor);
    cursor = addDaysIso(cursor, 1);
  }
  return days;
}

export function rangeForProjects(
  startDates: string[],
  endDates: string[],
  padDays = 20,
): { start: string; end: string; totalDays: number } {
  const all = [...startDates, ...endDates].filter(Boolean);
  if (all.length === 0) {
    const today = todayIso();
    return {
      start: addDaysIso(today, -30),
      end: addDaysIso(today, 90),
      totalDays: 120,
    };
  }
  const start = addDaysIso(minIso(all), -padDays);
  const end = addDaysIso(maxIso(all), padDays);
  return { start, end, totalDays: Math.max(1, diffDays(start, end)) };
}

export function positionPct(
  rangeStart: string,
  totalDays: number,
  date: string,
): number {
  return (diffDays(rangeStart, date) / totalDays) * 100;
}

export function widthPct(totalDays: number, durationDays: number): number {
  return (Math.max(1, durationDays) / totalDays) * 100;
}
