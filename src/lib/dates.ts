import { ASSUMPTIONS } from "./config";

const DAY = 86_400_000;

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
export function parseDate(s: string) {
  return new Date(s + "T00:00:00.000Z");
}
export function addDays(s: string, n: number) {
  return isoDate(new Date(parseDate(s).getTime() + n * DAY));
}
export function addWeeks(s: string, n: number) {
  return addDays(s, n * 7);
}

/** Cutoff timestamp for a batch (Ghana time = UTC). */
export function cutoffFor(batchDate: string) {
  const d = parseDate(addDays(batchDate, -ASSUMPTIONS.cutoffDaysBefore));
  d.setUTCHours(ASSUMPTIONS.cutoffHour, 0, 0, 0);
  return d;
}

/** The next batch still open for pre-orders. */
export function nextBatch(now = new Date()) {
  const today = isoDate(now);
  const dow = parseDate(today).getUTCDay();
  let candidate = addDays(today, (ASSUMPTIONS.batchWeekday - dow + 7) % 7);
  while (cutoffFor(candidate).getTime() <= now.getTime()) candidate = addWeeks(candidate, 1);
  return candidate;
}

export function isOpen(batchDate: string, now = new Date()) {
  return cutoffFor(batchDate).getTime() > now.getTime();
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts });

export function fmtBatch(batchDate: string) {
  return fmt({ weekday: "short", day: "numeric", month: "short" }).format(parseDate(batchDate));
}
export function fmtCutoff(batchDate: string) {
  const c = cutoffFor(batchDate);
  const h = c.getUTCHours();
  const hh = h === 12 ? "12pm" : h > 12 ? `${h - 12}pm` : `${h}am`;
  return `${fmt({ weekday: "short", day: "numeric", month: "short" }).format(c)}, ${hh}`;
}
export function fmtDateTime(iso: string) {
  return fmt({ day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
