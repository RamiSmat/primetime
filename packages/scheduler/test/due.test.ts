import assert from "node:assert/strict";
import test from "node:test";

import { isPrimerDue } from "../src/schedule.js";
import type { ScheduleConfig } from "../src/types.js";

const WEEKDAY_CONFIG: ScheduleConfig = {
  timeZone: "America/New_York",
  workStartTime: "09:00",
  leadTimeMinutes: 30,
  activeWeekdays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  deadTimeWindows: [],
};

test("is true within tolerance of the work-start instant", () => {
  const instant = new Date("2024-01-15T13:30:00Z");
  assert.equal(isPrimerDue(WEEKDAY_CONFIG, new Date(instant.getTime() + 5 * 60_000)), true);
  assert.equal(isPrimerDue(WEEKDAY_CONFIG, new Date(instant.getTime() - 5 * 60_000)), true);
});

test("is false outside tolerance of the work-start instant", () => {
  const instant = new Date("2024-01-15T13:30:00Z");
  assert.equal(isPrimerDue(WEEKDAY_CONFIG, new Date(instant.getTime() + 10 * 60_000)), false);
});

test("is false well outside tolerance of every primer instant", () => {
  assert.equal(isPrimerDue(WEEKDAY_CONFIG, new Date("2024-01-15T20:00:00Z")), false);
});

test("is true within tolerance of a dead-time-window re-prime instant", () => {
  const config: ScheduleConfig = {
    ...WEEKDAY_CONFIG,
    deadTimeWindows: [{ startTime: "12:00", endTime: "13:00" }],
  };
  // 13:00 EST minus a 30-minute lead time is 12:30 EST = 17:30Z.
  const instant = new Date("2024-01-15T17:30:00Z");
  assert.equal(isPrimerDue(config, new Date(instant.getTime() + 3 * 60_000)), true);
});

test("accepts a custom tolerance", () => {
  const instant = new Date("2024-01-15T13:30:00Z");
  const now = new Date(instant.getTime() + 20 * 60_000);
  assert.equal(isPrimerDue(WEEKDAY_CONFIG, now), false);
  assert.equal(isPrimerDue(WEEKDAY_CONFIG, now, 25), true);
});

test("is false when there are no active weekdays", () => {
  const config: ScheduleConfig = { ...WEEKDAY_CONFIG, activeWeekdays: [] };
  assert.equal(isPrimerDue(config, new Date("2024-01-15T13:30:00Z")), false);
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
  assert.equal(isPrimerDue(midnightRolloverConfig, now), true);
});
