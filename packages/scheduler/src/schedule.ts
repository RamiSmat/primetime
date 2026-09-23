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
 * Offsets 0 through 7 check every weekday at least once, and offset 7
 * always lands strictly after `now` even when today is active but its
 * primer time has already passed — so 8 candidates always suffice.
 */
const LOOKAHEAD_DAYS = 8;

export type PrimerReason = "work-start" | "dead-time-window-end";

export interface PrimerInstant {
  readonly instant: Date;
  readonly reason: PrimerReason;
}

/**
 * Computes every primer instant that falls on `calendarDate` (local to
 * `config.timeZone`), sorted ascending — empty if that date's local weekday
 * isn't in `config.activeWeekdays`. There is one instant `leadTimeMinutes`
 * before `workStartTime`, plus one `leadTimeMinutes` before the end of each
 * dead-time window, re-warming the session right as the user is expected
 * back from a gap (lunch, a meeting, ...).
 */
export function computePrimerInstantsForDate(
  config: ScheduleConfig,
  calendarDate: ZonedCalendarDate,
): readonly PrimerInstant[] {
  // Probe at midday to identify the local weekday unambiguously,
  // independent of any of the day's primer times and any DST transition
  // near midnight on the candidate date.
  const probeInstant = zonedTimeToUtc({ ...calendarDate, hour: 12, minute: 0 }, config.timeZone);
  const weekday = getZonedWeekday(probeInstant, config.timeZone);
  if (!config.activeWeekdays.includes(weekday)) {
    return [];
  }

  const instants: PrimerInstant[] = [];

  const { hour: workStartHour, minute: workStartMinute } = parseWorkStartTime(config.workStartTime);
  const workStartInstant = zonedTimeToUtc(
    { ...calendarDate, hour: workStartHour, minute: workStartMinute },
    config.timeZone,
  );
  instants.push({
    instant: new Date(workStartInstant.getTime() - config.leadTimeMinutes * 60_000),
    reason: "work-start",
  });

  for (const window of config.deadTimeWindows) {
    const { hour, minute } = parseWorkStartTime(window.endTime);
    const windowEndInstant = zonedTimeToUtc({ ...calendarDate, hour, minute }, config.timeZone);
    instants.push({
      instant: new Date(windowEndInstant.getTime() - config.leadTimeMinutes * 60_000),
      reason: "dead-time-window-end",
    });
  }

  instants.sort((a, b) => a.instant.getTime() - b.instant.getTime());
  return instants;
}

/**
 * Computes the next absolute instant, strictly after `now`, at which the
 * primer should run — the earliest of `computePrimerInstantsForDate`'s
 * results across the next active weekday. With no dead-time windows
 * configured this is exactly `leadTimeMinutes` before `workStartTime`.
 */
export function computeNextPrimerRun(config: ScheduleConfig, now: Date): Date {
  if (config.activeWeekdays.length === 0) {
    throw new NoActivePrimerWindowError();
  }

  const today = getZonedCalendarDate(now, config.timeZone);

  for (let dayOffset = 0; dayOffset < LOOKAHEAD_DAYS; dayOffset += 1) {
    const candidateDate = addCalendarDays(today, dayOffset);
    for (const { instant } of computePrimerInstantsForDate(config, candidateDate)) {
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
 * `toleranceMinutes` of any primer instant on the local calendar day
 * before, on, or after `now`. Checking three adjacent calendar days (rather
 * than just "today") sidesteps midnight-boundary edge cases entirely,
 * instead of special-casing them. Intended for a scheduled job that polls
 * on a fixed, frequent cadence (see `primetime schedule due`) and needs to
 * decide, timezone/DST-aware, whether this particular tick is the one that
 * should actually run the primer.
 */
export function isPrimerDue(
  config: ScheduleConfig,
  now: Date,
  toleranceMinutes: number = DEFAULT_DUE_TOLERANCE_MINUTES,
): boolean {
  if (config.activeWeekdays.length === 0) {
    return false;
  }

  const today = getZonedCalendarDate(now, config.timeZone);
  const toleranceMillis = toleranceMinutes * 60_000;

  for (const dayOffset of [-1, 0, 1]) {
    const candidateDate = addCalendarDays(today, dayOffset);
    for (const { instant } of computePrimerInstantsForDate(config, candidateDate)) {
      if (Math.abs(now.getTime() - instant.getTime()) <= toleranceMillis) {
        return true;
      }
    }
  }

  return false;
}
