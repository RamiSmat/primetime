import { PrimeTimeError } from "@primetime/shared";

import { parseWorkStartTime } from "./config.js";
import { addCalendarDays, getZonedCalendarDate, getZonedWeekday, zonedTimeToUtc } from "./timezone.js";
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

/**
 * Computes the next absolute instant, strictly after `now`, at which the
 * primer should run: `leadTimeMinutes` before `workStartTime`, local to
 * `timeZone`, on the next date whose local weekday is in
 * `activeWeekdays`.
 */
export function computeNextPrimerRun(config: ScheduleConfig, now: Date): Date {
  if (config.activeWeekdays.length === 0) {
    throw new NoActivePrimerWindowError();
  }

  const { hour: workStartHour, minute: workStartMinute } = parseWorkStartTime(config.workStartTime);
  const today = getZonedCalendarDate(now, config.timeZone);

  for (let dayOffset = 0; dayOffset < LOOKAHEAD_DAYS; dayOffset += 1) {
    const candidateDate = addCalendarDays(today, dayOffset);

    // Probe at midday to identify the local weekday unambiguously,
    // independent of the work-start time and any DST transition near
    // midnight on the candidate date.
    const probeInstant = zonedTimeToUtc({ ...candidateDate, hour: 12, minute: 0 }, config.timeZone);
    const weekday = getZonedWeekday(probeInstant, config.timeZone);

    if (!config.activeWeekdays.includes(weekday)) {
      continue;
    }

    const workStartInstant = zonedTimeToUtc(
      { ...candidateDate, hour: workStartHour, minute: workStartMinute },
      config.timeZone,
    );
    const primerInstant = new Date(workStartInstant.getTime() - config.leadTimeMinutes * 60_000);

    if (primerInstant.getTime() > now.getTime()) {
      return primerInstant;
    }
  }

  throw new NoActivePrimerWindowError();
}
