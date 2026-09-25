export type Weekday =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

export const WEEKDAYS: readonly Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export interface DeadTimeWindow {
  /** 24-hour local wall-clock time, "HH:MM", when this dead-time window starts. */
  readonly startTime: string;
  /**
   * 24-hour local wall-clock time, "HH:MM", when this dead-time window ends
   * and the user is expected to resume using AI agents. Strictly after
   * `startTime` — overnight windows that wrap past midnight aren't
   * supported yet.
   */
  readonly endTime: string;
}

export interface ScheduleConfig {
  /** IANA time zone identifier, e.g. "America/New_York". */
  readonly timeZone: string;
  /** 24-hour local wall-clock time, "HH:MM", when work normally starts. */
  readonly workStartTime: string;
  /**
   * A small safety-margin buffer, in minutes, applied before each moment
   * primer coverage first becomes needed: before `workStartTime` for the
   * day's first active stretch, and before the start of whichever
   * dead-time window immediately precedes a later stretch (never earlier
   * than that window's own start). Independent of how long a provider's
   * usage window actually stays warm -- see
   * `@primetime/scheduler#computePrimerInstantsForDate`'s `usageWindowMinutes`
   * parameter for that.
   */
  readonly leadTimeMinutes: number;
  /** Weekdays, local to timeZone, on which work normally starts. */
  readonly activeWeekdays: readonly Weekday[];
  /**
   * Recurring daily periods (lunch, meetings, evenings, ...) when the user
   * isn't using AI agents. Primer instants are never placed inside a
   * dead-time window; the active stretch that follows one is instead
   * re-warmed starting at (or, for a short window, right at) that window's
   * end -- see `computePrimerInstantsForDate` for exactly how. Non-overlapping.
   * Defaults to `[]` (a single active stretch spanning the whole day).
   */
  readonly deadTimeWindows: readonly DeadTimeWindow[];
}
