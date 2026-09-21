import { WEEKDAYS, type Weekday } from "./types.js";

const KNOWN_WEEKDAYS = new Set<string>(WEEKDAYS);

function isWeekday(value: string): value is Weekday {
  return KNOWN_WEEKDAYS.has(value);
}

export interface ZonedCalendarDate {
  readonly year: number;
  readonly month: number; // 1-12
  readonly day: number;
}

export interface ZonedTimeParts extends ZonedCalendarDate {
  readonly hour: number;
  readonly minute: number;
}

interface ZonedDateTimeParts extends ZonedTimeParts {
  readonly second: number;
  readonly weekday: Weekday;
}

function readZonedDateTimeParts(instant: Date, timeZone: string): ZonedDateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "long",
  });

  const values: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of formatter.formatToParts(instant)) {
    values[part.type] = part.value;
  }

  const weekday = (values.weekday ?? "").toLowerCase();
  if (!isWeekday(weekday)) {
    throw new Error(`Unexpected weekday "${values.weekday ?? ""}" reported for time zone "${timeZone}".`);
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
    weekday,
  };
}

function getUtcOffsetMinutes(instant: Date, timeZone: string): number {
  const zoned = readZonedDateTimeParts(instant, timeZone);
  const zonedAsUtcMillis = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second,
  );
  return (zonedAsUtcMillis - instant.getTime()) / 60_000;
}

/**
 * Converts a local wall-clock date/time within an IANA time zone into the
 * absolute UTC instant it refers to. This looks up the zone's UTC offset
 * at a naive first guess and applies it once — the same single-lookup
 * technique used by common timezone libraries. It correctly reflects
 * daylight-saving transitions on either side of the change, but (like
 * those libraries) does not disambiguate a wall-clock time that falls
 * exactly inside a "spring forward" gap or "fall back" overlap, which
 * does not occur for ordinary work-start times.
 */
export function zonedTimeToUtc(parts: ZonedTimeParts, timeZone: string): Date {
  const naiveUtcGuessMillis = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
  const offsetMinutes = getUtcOffsetMinutes(new Date(naiveUtcGuessMillis), timeZone);
  return new Date(naiveUtcGuessMillis - offsetMinutes * 60_000);
}

export function getZonedWeekday(instant: Date, timeZone: string): Weekday {
  return readZonedDateTimeParts(instant, timeZone).weekday;
}

export function getZonedCalendarDate(instant: Date, timeZone: string): ZonedCalendarDate {
  const { year, month, day } = readZonedDateTimeParts(instant, timeZone);
  return { year, month, day };
}

/** Pure calendar-day arithmetic; not tied to any particular time zone's wall clock. */
export function addCalendarDays(date: ZonedCalendarDate, days: number): ZonedCalendarDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days, 12, 0, 0));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}
