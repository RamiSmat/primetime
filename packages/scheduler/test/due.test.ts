import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_DUE_TOLERANCE_MINUTES, isPrimerDue } from "../src/schedule.js";
import type { ScheduleConfig } from "../src/types.js";

const WEEKDAY_CONFIG: ScheduleConfig = {
  timeZone: "America/New_York",
  workStartTime: "09:00",
  leadTimeMinutes: 30,
  activeWeekdays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  deadTimeWindows: [],
};

/** Long enough that no rolling-refresh instant is ever added across these fixtures. */
const LONG_USAGE_WINDOW_MINUTES = 24 * 60;

test("is true within tolerance of the work-start instant", () => {
  const instant = new Date("2024-01-15T13:30:00Z");
  assert.equal(
    isPrimerDue(WEEKDAY_CONFIG, new Date(instant.getTime() + 5 * 60_000), LONG_USAGE_WINDOW_MINUTES),
    true,
  );
  assert.equal(
    isPrimerDue(WEEKDAY_CONFIG, new Date(instant.getTime() - 5 * 60_000), LONG_USAGE_WINDOW_MINUTES),
    true,
  );
});

test("is false outside tolerance of the work-start instant", () => {
  const instant = new Date("2024-01-15T13:30:00Z");
  assert.equal(
    isPrimerDue(WEEKDAY_CONFIG, new Date(instant.getTime() + 10 * 60_000), LONG_USAGE_WINDOW_MINUTES),
    false,
  );
});

test("is false well outside tolerance of every primer instant", () => {
  assert.equal(isPrimerDue(WEEKDAY_CONFIG, new Date("2024-01-15T20:00:00Z"), LONG_USAGE_WINDOW_MINUTES), false);
});

test("is true within tolerance of a dead-time-window re-prime instant", () => {
  const config: ScheduleConfig = {
    ...WEEKDAY_CONFIG,
    deadTimeWindows: [{ startTime: "12:00", endTime: "13:00" }],
  };
  // 13:00 EST minus a 30-minute lead time is 12:30 EST = 17:30Z.
  const instant = new Date("2024-01-15T17:30:00Z");
  assert.equal(
    isPrimerDue(config, new Date(instant.getTime() + 3 * 60_000), LONG_USAGE_WINDOW_MINUTES),
    true,
  );
});

test("accepts a custom tolerance", () => {
  const instant = new Date("2024-01-15T13:30:00Z");
  const now = new Date(instant.getTime() + 20 * 60_000);
  assert.equal(isPrimerDue(WEEKDAY_CONFIG, now, LONG_USAGE_WINDOW_MINUTES), false);
  assert.equal(isPrimerDue(WEEKDAY_CONFIG, now, LONG_USAGE_WINDOW_MINUTES, 25), true);
});

test("catches up on an instant missed by more than the tolerance when lastPrimedAt predates it", () => {
  const instant = new Date("2024-01-15T13:30:00Z");
  const wellPastTolerance = new Date(instant.getTime() + 60 * 60_000);
  assert.equal(isPrimerDue(WEEKDAY_CONFIG, wellPastTolerance, LONG_USAGE_WINDOW_MINUTES), false);

  const lastPrimedAt = new Date(instant.getTime() - 60_000);
  assert.equal(
    isPrimerDue(
      WEEKDAY_CONFIG,
      wellPastTolerance,
      LONG_USAGE_WINDOW_MINUTES,
      DEFAULT_DUE_TOLERANCE_MINUTES,
      lastPrimedAt,
    ),
    true,
  );
});

test("does not catch up once a primer already ran at or after the instant", () => {
  const instant = new Date("2024-01-15T13:30:00Z");
  const wellPastTolerance = new Date(instant.getTime() + 60 * 60_000);
  const lastPrimedAt = new Date(instant.getTime() + 60_000);
  assert.equal(
    isPrimerDue(
      WEEKDAY_CONFIG,
      wellPastTolerance,
      LONG_USAGE_WINDOW_MINUTES,
      DEFAULT_DUE_TOLERANCE_MINUTES,
      lastPrimedAt,
    ),
    false,
  );
});

test("does not re-fire within tolerance once a primer already ran for that instant", () => {
  // A later tick that still lands inside the (widened) tolerance window
  // must not re-report due once lastPrimedAt already covers the instant --
  // otherwise every tick in a wide window would re-run the primer.
  const instant = new Date("2024-01-15T13:30:00Z");
  const stillWithinTolerance = new Date(instant.getTime() + 5 * 60_000);
  const lastPrimedAt = new Date(instant.getTime() + 60_000);
  assert.equal(
    isPrimerDue(
      WEEKDAY_CONFIG,
      stillWithinTolerance,
      LONG_USAGE_WINDOW_MINUTES,
      DEFAULT_DUE_TOLERANCE_MINUTES,
      lastPrimedAt,
    ),
    false,
  );
});

test("does not catch up on a future instant even with a stale lastPrimedAt", () => {
  const instant = new Date("2024-01-15T13:30:00Z");
  const beforeInstant = new Date(instant.getTime() - 60 * 60_000);
  const lastPrimedAt = new Date(instant.getTime() - 2 * 24 * 60 * 60_000);
  assert.equal(
    isPrimerDue(
      WEEKDAY_CONFIG,
      beforeInstant,
      LONG_USAGE_WINDOW_MINUTES,
      DEFAULT_DUE_TOLERANCE_MINUTES,
      lastPrimedAt,
    ),
    false,
  );
});

test("is false when there are no active weekdays", () => {
  const config: ScheduleConfig = { ...WEEKDAY_CONFIG, activeWeekdays: [] };
  assert.equal(isPrimerDue(config, new Date("2024-01-15T13:30:00Z"), LONG_USAGE_WINDOW_MINUTES), false);
});

test("finds a primer instant that lands on the local calendar day adjacent to now's own local day", () => {
  // Monday's work-start primer (00:10 EST minus a 20-minute lead time) is
  // Sunday 23:50 EST, i.e. Monday 04:50 UTC -- but "now"'s own local
  // calendar date (per config.timeZone) is Sunday, which isn't an active
  // weekday. Only checking "yesterday/today/tomorrow" relative to now's
  // local date finds this instant; checking only "today" would miss it.
  const midnightRolloverConfig: ScheduleConfig = {
    timeZone: "America/New_York",
    workStartTime: "00:10",
    leadTimeMinutes: 20,
    activeWeekdays: ["monday"],
    deadTimeWindows: [],
  };
  const now = new Date("2024-01-15T04:50:00Z");
  assert.equal(isPrimerDue(midnightRolloverConfig, now, LONG_USAGE_WINDOW_MINUTES), true);
});

test("usageWindowMinutes actually reaches the computation: two otherwise-identical calls can disagree", () => {
  // With a short usage window, a rolling-refresh instant lands at
  // 13:30Z + (300 - 30)min = 18:00Z; with a long one, no such instant
  // exists, so the same `now` is due under one window length and not the
  // other.
  const now = new Date("2024-01-15T18:00:00Z");
  assert.equal(isPrimerDue(WEEKDAY_CONFIG, now, 300), true);
  assert.equal(isPrimerDue(WEEKDAY_CONFIG, now, LONG_USAGE_WINDOW_MINUTES), false);
});
