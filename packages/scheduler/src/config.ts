import { PrimeTimeError } from "@primetime/shared";

import { WEEKDAYS, type ScheduleConfig, type Weekday } from "./types.js";

export class InvalidScheduleConfigError extends PrimeTimeError {
  public constructor(reason: string) {
    super("invalid_configuration", `Invalid schedule configuration: ${reason}`);
    this.name = "InvalidScheduleConfigError";
  }
}

const WORK_START_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface WorkStartTime {
  readonly hour: number;
  readonly minute: number;
}

export function parseWorkStartTime(value: string): WorkStartTime {
  const match = WORK_START_TIME_PATTERN.exec(value);
  if (!match) {
    throw new InvalidScheduleConfigError(
      `workStartTime must be a 24-hour "HH:MM" string, received ${JSON.stringify(value)}.`,
    );
  }

  // Both capture groups are guaranteed present whenever the pattern matches.
  return { hour: Number(match[1]!), minute: Number(match[2]!) };
}

function isKnownWeekday(value: unknown): value is Weekday {
  return typeof value === "string" && (WEEKDAYS as readonly string[]).includes(value);
}

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Parses and validates an untrusted configuration object (e.g. from a web
 * form or a config file) into a {@link ScheduleConfig}. Every failure
 * throws an {@link InvalidScheduleConfigError} describing what was wrong,
 * never a generic or silent fallback.
 */
export function parseScheduleConfig(raw: unknown): ScheduleConfig {
  if (typeof raw !== "object" || raw === null) {
    throw new InvalidScheduleConfigError("expected an object.");
  }

  const candidate = raw as Record<string, unknown>;

  if (typeof candidate.timeZone !== "string" || candidate.timeZone.trim() === "") {
    throw new InvalidScheduleConfigError("timeZone must be a non-empty string.");
  }
  if (!isValidTimeZone(candidate.timeZone)) {
    throw new InvalidScheduleConfigError(
      `timeZone ${JSON.stringify(candidate.timeZone)} is not a recognized IANA time zone.`,
    );
  }

  if (typeof candidate.workStartTime !== "string") {
    throw new InvalidScheduleConfigError("workStartTime must be a string.");
  }
  parseWorkStartTime(candidate.workStartTime);

  if (
    typeof candidate.leadTimeMinutes !== "number" ||
    !Number.isInteger(candidate.leadTimeMinutes) ||
    candidate.leadTimeMinutes < 0
  ) {
    throw new InvalidScheduleConfigError("leadTimeMinutes must be a non-negative integer.");
  }

  if (!Array.isArray(candidate.activeWeekdays) || candidate.activeWeekdays.length === 0) {
    throw new InvalidScheduleConfigError("activeWeekdays must be a non-empty array of weekday names.");
  }
  for (const day of candidate.activeWeekdays) {
    if (!isKnownWeekday(day)) {
      throw new InvalidScheduleConfigError(
        `activeWeekdays contains an unrecognized value: ${JSON.stringify(day)}.`,
      );
    }
  }

  return {
    timeZone: candidate.timeZone,
    workStartTime: candidate.workStartTime,
    leadTimeMinutes: candidate.leadTimeMinutes,
    activeWeekdays: candidate.activeWeekdays as Weekday[],
  };
}
