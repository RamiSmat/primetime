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
  /** Minutes before workStartTime the primer should run. */
  readonly leadTimeMinutes: number;
  /** Weekdays, local to timeZone, on which work normally starts. */
  readonly activeWeekdays: readonly Weekday[];
  /**
   * Recurring daily periods (lunch, meetings, evenings, ...) when the user
   * isn't using AI agents. A primer also runs `leadTimeMinutes` before each
   * window's `endTime`, re-warming the session ahead of when work resumes.
   * Non-overlapping. Defaults to `[]` (single work-start primer per day,
   * matching pre-dead-time-window behavior).
   */
  readonly deadTimeWindows: readonly DeadTimeWindow[];
}
