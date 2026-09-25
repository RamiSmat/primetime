import { PrimeTimeError } from "@primetime/shared";

import { parseWorkStartTime } from "./config.js";
import {
  addCalendarDays,
  getZonedCalendarDate,
  getZonedWeekday,
  zonedTimeToUtc,
  type ZonedCalendarDate,
} from "./timezone.js";
import type { ScheduleConfig } from "./types.js";

export class NoActivePrimerWindowError extends PrimeTimeError {
  public constructor() {
    super(
      "invalid_configuration",
      "Could not find an upcoming active weekday to schedule a primer run.",
    );
    this.name = "NoActivePrimerWindowError";
  }
}

/**
 * Thrown by `computePrimerInstantsForDate` (and anything built on it) when
 * `config.leadTimeMinutes` is not strictly less than the caller-supplied
 * `usageWindowMinutes` -- a lead time that large or larger can never
 * produce a sensible instant, since there would be no time left in the
 * window to actually cover once the lead-time buffer is subtracted.
 */
export class LeadTimeExceedsUsageWindowError extends PrimeTimeError {
  public constructor(leadTimeMinutes: number, usageWindowMinutes: number) {
    super(
      "invalid_configuration",
      `leadTimeMinutes (${leadTimeMinutes}) must be less than usageWindowMinutes (${usageWindowMinutes}).`,
    );
    this.name = "LeadTimeExceedsUsageWindowError";
  }
}

/**
 * Offsets 0 through 7 check every weekday at least once, and offset 7
 * always lands strictly after `now` even when today is active but its
 * primer time has already passed — so 8 candidates always suffice.
 */
const LOOKAHEAD_DAYS = 8;

export type PrimerReason = "work-start" | "dead-time-window-end" | "rolling-refresh";

export interface PrimerInstant {
  readonly instant: Date;
  readonly reason: PrimerReason;
}

/**
 * One contiguous stretch of active (non-dead-time) local time on a given
 * calendar date, already clipped to `[workStart, dayEnd)`.
 * `precedingWindowStart` is the UTC start of the dead-time window
 * immediately before this interval, or `null` for the day's first
 * interval (which instead follows `workStartTime`).
 */
interface ActiveInterval {
  readonly start: Date;
  readonly end: Date;
  readonly precedingWindowStart: Date | null;
}

function clampToRange(instant: Date, min: Date, max: Date): Date {
  if (instant.getTime() < min.getTime()) {
    return min;
  }
  if (instant.getTime() > max.getTime()) {
    return max;
  }
  return instant;
}

/**
 * Computes every primer instant that falls on `calendarDate` (local to
 * `config.timeZone`), sorted ascending — empty if that date's local weekday
 * isn't in `config.activeWeekdays`.
 *
 * `usageWindowMinutes` (supplied by the caller — see
 * `ProviderAdapter.usageWindowMinutes`) is how long the provider's usage
 * window stays warm after a primer; it drives how far apart instants need
 * to be to keep the window continuously covered. `config.leadTimeMinutes`
 * is a small safety margin applied before each moment coverage first
 * becomes needed: before `workStartTime` for the day's first active
 * stretch, or before the start of whichever dead-time window immediately
 * precedes a later stretch — but never earlier than that window's own
 * start, since firing before the dead-time window even begins would make
 * no sense. (This clamp is what keeps a `leadTimeMinutes` larger than a
 * short dead-time window from producing a nonsensical instant, e.g. one
 * that lands before the window starts.) A stretch of active time longer
 * than `usageWindowMinutes` gets additional `"rolling-refresh"` instants,
 * spaced `usageWindowMinutes - leadTimeMinutes` apart, so the window never
 * lapses mid-stretch.
 *
 * Throws `LeadTimeExceedsUsageWindowError` if `leadTimeMinutes` isn't
 * strictly less than `usageWindowMinutes`.
 */
export function computePrimerInstantsForDate(
  config: ScheduleConfig,
  calendarDate: ZonedCalendarDate,
  usageWindowMinutes: number,
): readonly PrimerInstant[] {
  // Probe at midday to identify the local weekday unambiguously,
  // independent of any of the day's primer times and any DST transition
  // near midnight on the candidate date.
  const probeInstant = zonedTimeToUtc({ ...calendarDate, hour: 12, minute: 0 }, config.timeZone);
  const weekday = getZonedWeekday(probeInstant, config.timeZone);
  if (!config.activeWeekdays.includes(weekday)) {
    return [];
  }

  const leadMs = config.leadTimeMinutes * 60_000;
  const windowMs = usageWindowMinutes * 60_000;
  if (leadMs >= windowMs) {
    throw new LeadTimeExceedsUsageWindowError(config.leadTimeMinutes, usageWindowMinutes);
  }
  const cycleMs = windowMs - leadMs;

  const { hour: workStartHour, minute: workStartMinute } = parseWorkStartTime(config.workStartTime);
  const workStart = zonedTimeToUtc(
    { ...calendarDate, hour: workStartHour, minute: workStartMinute },
    config.timeZone,
  );
  // Local midnight starting the next calendar date -- the exclusive upper
  // bound of "active hours" on `calendarDate`.
  const dayEnd = zonedTimeToUtc(
    { ...addCalendarDays(calendarDate, 1), hour: 0, minute: 0 },
    config.timeZone,
  );

  const windows = config.deadTimeWindows
    .map((window) => {
      const start = parseWorkStartTime(window.startTime);
      const end = parseWorkStartTime(window.endTime);
      return {
        start: clampToRange(
          zonedTimeToUtc({ ...calendarDate, ...start }, config.timeZone),
          workStart,
          dayEnd,
        ),
        end: clampToRange(
          zonedTimeToUtc({ ...calendarDate, ...end }, config.timeZone),
          workStart,
          dayEnd,
        ),
      };
    })
    // Drop any window that clamps down to zero length -- fully outside
    // this date's active hours (e.g. entirely before workStartTime).
    .filter((window) => window.end.getTime() > window.start.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const intervals: ActiveInterval[] = [];
  let cursor = workStart;
  let precedingWindowStart: Date | null = null;
  for (const window of windows) {
    if (window.end.getTime() <= cursor.getTime()) {
      // Already behind the cursor (can happen after clamping); skip.
      continue;
    }
    if (window.start.getTime() > cursor.getTime()) {
      intervals.push({ start: cursor, end: window.start, precedingWindowStart });
    }
    if (window.end.getTime() > cursor.getTime()) {
      cursor = window.end;
    }
    precedingWindowStart = window.start;
  }
  if (cursor.getTime() < dayEnd.getTime()) {
    intervals.push({ start: cursor, end: dayEnd, precedingWindowStart });
  }

  const instants: PrimerInstant[] = [];
  for (const interval of intervals) {
    const naiveMs = interval.start.getTime() - leadMs;
    const firstMs =
      interval.precedingWindowStart !== null && naiveMs < interval.precedingWindowStart.getTime()
        ? interval.precedingWindowStart.getTime()
        : naiveMs;
    const reason: PrimerReason =
      interval.precedingWindowStart === null ? "work-start" : "dead-time-window-end";
    instants.push({ instant: new Date(firstMs), reason });

    let t = firstMs;
    while (t + windowMs < interval.end.getTime()) {
      t += cycleMs;
      instants.push({ instant: new Date(t), reason: "rolling-refresh" });
    }
  }

  instants.sort((a, b) => a.instant.getTime() - b.instant.getTime());
  return instants;
}

/**
 * Computes the next absolute instant, strictly after `now`, at which the
 * primer should run — the earliest of `computePrimerInstantsForDate`'s
 * results across the next active weekday, for the given `usageWindowMinutes`.
 */
export function computeNextPrimerRun(
  config: ScheduleConfig,
  now: Date,
  usageWindowMinutes: number,
): Date {
  if (config.activeWeekdays.length === 0) {
    throw new NoActivePrimerWindowError();
  }

  const today = getZonedCalendarDate(now, config.timeZone);

  for (let dayOffset = 0; dayOffset < LOOKAHEAD_DAYS; dayOffset += 1) {
    const candidateDate = addCalendarDays(today, dayOffset);
    for (const { instant } of computePrimerInstantsForDate(config, candidateDate, usageWindowMinutes)) {
      if (instant.getTime() > now.getTime()) {
        return instant;
      }
    }
  }

  throw new NoActivePrimerWindowError();
}

export const DEFAULT_DUE_TOLERANCE_MINUTES = 8;

/**
 * Answers whether a primer is due right now: whether `now` falls within
 * `toleranceMinutes` of any primer instant (computed against
 * `usageWindowMinutes`) on the local calendar day before, on, or after
 * `now`. Checking three adjacent calendar days (rather than just "today")
 * sidesteps midnight-boundary edge cases entirely, instead of
 * special-casing them. Intended for a scheduled job that polls on a fixed,
 * frequent cadence (see `primetime schedule due`) and needs to decide,
 * timezone/DST-aware, whether this particular tick is the one that should
 * actually run the primer.
 *
 * When `lastPrimedAt` is given, an already-passed instant is also treated as
 * due as long as no successful primer has happened since it — a catch-up
 * for a scheduler (GitHub Actions' `schedule` trigger, notably) whose ticks
 * are best-effort and can be delayed or dropped for far longer than any
 * fixed symmetric tolerance could reasonably absorb. Bounded to at most a
 * one-day lag by only ever considering yesterday/today/tomorrow's instants.
 * `lastPrimedAt` also suppresses the ordinary tolerance check once it's at
 * or after an instant, so a wide tolerance window doesn't make every tick
 * still inside it re-fire a primer that already ran for that instant.
 * Without `lastPrimedAt`, behavior is unchanged: a missed tolerance window
 * means that instant is simply never due, and there's no re-fire guard.
 */
export function isPrimerDue(
  config: ScheduleConfig,
  now: Date,
  usageWindowMinutes: number,
  toleranceMinutes: number = DEFAULT_DUE_TOLERANCE_MINUTES,
  lastPrimedAt?: Date,
): boolean {
  if (config.activeWeekdays.length === 0) {
    return false;
  }

  const today = getZonedCalendarDate(now, config.timeZone);
  const toleranceMillis = toleranceMinutes * 60_000;

  for (const dayOffset of [-1, 0, 1]) {
    const candidateDate = addCalendarDays(today, dayOffset);
    for (const { instant } of computePrimerInstantsForDate(config, candidateDate, usageWindowMinutes)) {
      // A primer at or after this instant already covers it -- skip it
      // entirely so a wide tolerance window (needed to absorb GitHub's
      // scheduling jitter) doesn't re-fire on every later tick that still
      // happens to land within it.
      if (lastPrimedAt !== undefined && lastPrimedAt.getTime() >= instant.getTime()) {
        continue;
      }

      if (Math.abs(now.getTime() - instant.getTime()) <= toleranceMillis) {
        return true;
      }

      const isPastInstant = instant.getTime() <= now.getTime();
      if (lastPrimedAt !== undefined && isPastInstant) {
        return true;
      }
    }
  }

  return false;
}
