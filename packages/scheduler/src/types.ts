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

export interface ScheduleConfig {
  /** IANA time zone identifier, e.g. "America/New_York". */
  readonly timeZone: string;
  /** 24-hour local wall-clock time, "HH:MM", when work normally starts. */
  readonly workStartTime: string;
  /** Minutes before workStartTime the primer should run. */
  readonly leadTimeMinutes: number;
  /** Weekdays, local to timeZone, on which work normally starts. */
  readonly activeWeekdays: readonly Weekday[];
}
