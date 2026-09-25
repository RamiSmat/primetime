import assert from "node:assert/strict";
import test from "node:test";

import {
  computeNextPrimerRun,
  computePrimerInstantsForDate,
  LeadTimeExceedsUsageWindowError,
  NoActivePrimerWindowError,
} from "../src/schedule.js";
import type { ScheduleConfig } from "../src/types.js";

const WEEKDAY_CONFIG: ScheduleConfig = {
  timeZone: "America/New_York",
  workStartTime: "09:00",
  leadTimeMinutes: 30,
  activeWeekdays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  deadTimeWindows: [],
};

/**
 * A usage window far longer than any active stretch used in these fixtures,
 * so no rolling-refresh instants are ever added -- reproduces the exact
 * single-instant-per-event behavior this module had before usage-window
 * durations existed.
 */
const LONG_USAGE_WINDOW_MINUTES = 24 * 60;

/** A realistic provider usage-window length, for cases that exercise rolling refresh. */
const SHORT_USAGE_WINDOW_MINUTES = 300;

test("computes today's primer time when it is still ahead, in winter (EST)", () => {
  // 2024-01-15 is a Monday. now = 10:00Z = 05:00 EST, well before 08:30 EST primer time.
  const result = computeNextPrimerRun(WEEKDAY_CONFIG, new Date("2024-01-15T10:00:00Z"), LONG_USAGE_WINDOW_MINUTES);
  assert.equal(result.toISOString(), "2024-01-15T13:30:00.000Z");
});

test("computes today's primer time when it is still ahead, in summer (EDT)", () => {
  // 2024-07-15 is a Monday. now = 10:00Z = 06:00 EDT, before 08:30 EDT primer time.
  const result = computeNextPrimerRun(WEEKDAY_CONFIG, new Date("2024-07-15T10:00:00Z"), LONG_USAGE_WINDOW_MINUTES);
  assert.equal(result.toISOString(), "2024-07-15T12:30:00.000Z");
});

test("rolls over to the next active weekday once today's primer time has passed", () => {
  // 2024-01-15 is a Monday; by 20:00Z (15:00 EST) the 08:30 EST primer time is long past.
  // The next active weekday is Tuesday 2024-01-16.
  const result = computeNextPrimerRun(WEEKDAY_CONFIG, new Date("2024-01-15T20:00:00Z"), LONG_USAGE_WINDOW_MINUTES);
  assert.equal(result.toISOString(), "2024-01-16T13:30:00.000Z");
});

test("skips inactive weekdays to find the next active one", () => {
  // 2024-01-19 is a Friday; with only weekdays active, next primer is Monday 2024-01-22.
  const result = computeNextPrimerRun(WEEKDAY_CONFIG, new Date("2024-01-19T20:00:00Z"), LONG_USAGE_WINDOW_MINUTES);
  assert.equal(result.toISOString(), "2024-01-22T13:30:00.000Z");
});

test("crosses the spring-forward DST transition correctly when rolling over a weekend", () => {
  // 2024-03-08 is a Friday, well past that day's primer time (EST, UTC-5).
  // DST begins 2024-03-10. The next active weekday, Monday 2024-03-11, is
  // already EDT (UTC-4), so its primer instant must reflect the new offset.
  const result = computeNextPrimerRun(WEEKDAY_CONFIG, new Date("2024-03-08T20:00:00Z"), LONG_USAGE_WINDOW_MINUTES);
  assert.equal(result.toISOString(), "2024-03-11T12:30:00.000Z");
});

test("wraps around a full week when only one weekday is active", () => {
  const fridayOnly: ScheduleConfig = { ...WEEKDAY_CONFIG, activeWeekdays: ["friday"] };
  // 2024-01-19 is a Friday, after that day's primer time; next Friday is 2024-01-26.
  const result = computeNextPrimerRun(fridayOnly, new Date("2024-01-19T20:00:00Z"), LONG_USAGE_WINDOW_MINUTES);
  assert.equal(result.toISOString(), "2024-01-26T13:30:00.000Z");
});

test("treats a candidate exactly at now as already passed (strictly-after semantics)", () => {
  const firstRun = computeNextPrimerRun(WEEKDAY_CONFIG, new Date("2024-01-15T10:00:00Z"), LONG_USAGE_WINDOW_MINUTES);
  // Re-running with `now` set to exactly the previously computed primer
  // instant must not return that same instant again — it must advance.
  const secondRun = computeNextPrimerRun(WEEKDAY_CONFIG, firstRun, LONG_USAGE_WINDOW_MINUTES);
  assert.equal(secondRun.toISOString(), "2024-01-16T13:30:00.000Z");
});

test("recalculates correctly as the current time advances (schedule updates)", () => {
  const morning = computeNextPrimerRun(WEEKDAY_CONFIG, new Date("2024-01-15T10:00:00Z"), LONG_USAGE_WINDOW_MINUTES);
  const afternoon = computeNextPrimerRun(WEEKDAY_CONFIG, new Date("2024-01-15T18:00:00Z"), LONG_USAGE_WINDOW_MINUTES);
  assert.equal(morning.toISOString(), "2024-01-15T13:30:00.000Z");
  assert.equal(afternoon.toISOString(), "2024-01-16T13:30:00.000Z");
});

test("applies a large lead time correctly", () => {
  // 90 minutes before 09:00 EST is 07:30 EST = 12:30Z.
  const longLeadTime: ScheduleConfig = { ...WEEKDAY_CONFIG, leadTimeMinutes: 90 };
  const result = computeNextPrimerRun(longLeadTime, new Date("2024-01-15T10:00:00Z"), LONG_USAGE_WINDOW_MINUTES);
  assert.equal(result.toISOString(), "2024-01-15T12:30:00.000Z");
});

test("throws when there are no active weekdays", () => {
  const noActiveDays: ScheduleConfig = { ...WEEKDAY_CONFIG, activeWeekdays: [] };
  assert.throws(
    () => computeNextPrimerRun(noActiveDays, new Date("2024-01-15T10:00:00Z"), LONG_USAGE_WINDOW_MINUTES),
    NoActivePrimerWindowError,
  );
});

test("computePrimerInstantsForDate returns nothing on an inactive weekday", () => {
  // 2024-01-14 is a Sunday, not in WEEKDAY_CONFIG's activeWeekdays.
  const result = computePrimerInstantsForDate(
    WEEKDAY_CONFIG,
    { year: 2024, month: 1, day: 14 },
    LONG_USAGE_WINDOW_MINUTES,
  );
  assert.deepEqual(result, []);
});

test("computePrimerInstantsForDate returns just the work-start instant with no dead-time windows", () => {
  const result = computePrimerInstantsForDate(
    WEEKDAY_CONFIG,
    { year: 2024, month: 1, day: 15 },
    LONG_USAGE_WINDOW_MINUTES,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0]!.reason, "work-start");
  assert.equal(result[0]!.instant.toISOString(), "2024-01-15T13:30:00.000Z");
});

test("computePrimerInstantsForDate adds a re-prime instant before each dead-time window ends", () => {
  const config: ScheduleConfig = {
    ...WEEKDAY_CONFIG,
    deadTimeWindows: [{ startTime: "12:00", endTime: "13:00" }],
  };
  const result = computePrimerInstantsForDate(config, { year: 2024, month: 1, day: 15 }, LONG_USAGE_WINDOW_MINUTES);
  assert.equal(result.length, 2);
  assert.equal(result[0]!.reason, "work-start");
  assert.equal(result[0]!.instant.toISOString(), "2024-01-15T13:30:00.000Z");
  assert.equal(result[1]!.reason, "dead-time-window-end");
  // 13:00 EST minus a 30-minute lead time is 12:30 EST = 17:30Z.
  assert.equal(result[1]!.instant.toISOString(), "2024-01-15T17:30:00.000Z");
});

test("computes a dead-time window's re-prime instant correctly across a DST transition", () => {
  const config: ScheduleConfig = {
    ...WEEKDAY_CONFIG,
    deadTimeWindows: [{ startTime: "13:00", endTime: "14:00" }],
  };
  // 2024-03-11 is already EDT (UTC-4): 14:00 EDT minus 30 minutes is 13:30 EDT = 17:30Z,
  // one hour earlier than the equivalent EST instant would be.
  const result = computePrimerInstantsForDate(config, { year: 2024, month: 3, day: 11 }, LONG_USAGE_WINDOW_MINUTES);
  assert.equal(result[1]!.instant.toISOString(), "2024-03-11T17:30:00.000Z");
});

test("computeNextPrimerRun advances to a same-day dead-time-window re-prime rather than skipping to the next day", () => {
  const config: ScheduleConfig = {
    ...WEEKDAY_CONFIG,
    deadTimeWindows: [{ startTime: "12:00", endTime: "13:00" }],
  };
  // 14:00Z = 09:00 EST: today's work-start primer (13:30Z) has passed, but the
  // dead-time-window re-prime (17:30Z) has not.
  const result = computeNextPrimerRun(config, new Date("2024-01-15T14:00:00Z"), LONG_USAGE_WINDOW_MINUTES);
  assert.equal(result.toISOString(), "2024-01-15T17:30:00.000Z");
});

test("computeNextPrimerRun behaves exactly as before when deadTimeWindows is empty", () => {
  const result = computeNextPrimerRun(WEEKDAY_CONFIG, new Date("2024-01-15T10:00:00Z"), LONG_USAGE_WINDOW_MINUTES);
  assert.equal(result.toISOString(), "2024-01-15T13:30:00.000Z");
});

test("regression: a lead time longer than a short dead-time window clamps to the window's own start instead of preceding it", () => {
  // This reproduces the reported bug: leadTimeMinutes=120 with a 90-minute
  // dead-time window (12:00-13:30) naively computes 13:30 - 120min = 11:30,
  // before the window even starts. The fix clamps that instant to 12:00.
  const config: ScheduleConfig = {
    ...WEEKDAY_CONFIG,
    leadTimeMinutes: 120,
    deadTimeWindows: [{ startTime: "12:00", endTime: "13:30" }],
  };
  const result = computePrimerInstantsForDate(config, { year: 2024, month: 1, day: 15 }, SHORT_USAGE_WINDOW_MINUTES);
  const deadTimeInstant = result.find((instant) => instant.reason === "dead-time-window-end");
  assert.ok(deadTimeInstant, "expected a dead-time-window-end instant");
  // 12:00 EST = 17:00Z -- clamped to the window's own start, never earlier.
  assert.equal(deadTimeInstant.instant.toISOString(), "2024-01-15T17:00:00.000Z");
});

test("clamps a dead-time-window-end instant to the window's own start rather than firing earlier", () => {
  // A 5-minute dead-time window, shorter than the 45-minute lead time: the
  // naive instant (09:10 - 45min = 08:25 EST) would precede the window's own
  // start (09:05 EST), so it must clamp to the window's start instead.
  const config: ScheduleConfig = {
    ...WEEKDAY_CONFIG,
    leadTimeMinutes: 45,
    deadTimeWindows: [{ startTime: "09:05", endTime: "09:10" }],
  };
  const result = computePrimerInstantsForDate(config, { year: 2024, month: 1, day: 15 }, SHORT_USAGE_WINDOW_MINUTES);
  const deadTimeInstant = result.find((instant) => instant.reason === "dead-time-window-end");
  assert.ok(deadTimeInstant, "expected a dead-time-window-end instant");
  // 09:05 EST = 14:05Z.
  assert.equal(deadTimeInstant.instant.toISOString(), "2024-01-15T14:05:00.000Z");
});

test("computes multiple active intervals for a day with two dead-time windows", () => {
  const config: ScheduleConfig = {
    ...WEEKDAY_CONFIG,
    deadTimeWindows: [
      { startTime: "12:00", endTime: "13:00" },
      { startTime: "16:00", endTime: "16:30" },
    ],
  };
  const result = computePrimerInstantsForDate(config, { year: 2024, month: 1, day: 15 }, LONG_USAGE_WINDOW_MINUTES);
  assert.deepEqual(
    result.map((instant) => instant.reason),
    ["work-start", "dead-time-window-end", "dead-time-window-end"],
  );
});

test("adds rolling-refresh instants spaced usageWindowMinutes - leadTimeMinutes apart across a long day with no dead zones", () => {
  const result = computePrimerInstantsForDate(
    WEEKDAY_CONFIG,
    { year: 2024, month: 1, day: 15 },
    SHORT_USAGE_WINDOW_MINUTES,
  );
  // workStart 09:00 EST minus 30min lead = 08:30 EST = 13:30Z; cycle is
  // 300 - 30 = 270 minutes; local midnight (dayEnd) is 05:00Z the next day.
  assert.deepEqual(
    result.map((instant) => instant.instant.toISOString()),
    ["2024-01-15T13:30:00.000Z", "2024-01-15T18:00:00.000Z", "2024-01-15T22:30:00.000Z", "2024-01-16T03:00:00.000Z"],
  );
  assert.deepEqual(
    result.map((instant) => instant.reason),
    ["work-start", "rolling-refresh", "rolling-refresh", "rolling-refresh"],
  );
});

test("produces just one instant for a short active day with no dead zones, unchanged from the legacy single-instant model", () => {
  const shortDay: ScheduleConfig = { ...WEEKDAY_CONFIG, workStartTime: "20:00", leadTimeMinutes: 10 };
  const result = computePrimerInstantsForDate(shortDay, { year: 2024, month: 1, day: 15 }, SHORT_USAGE_WINDOW_MINUTES);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.reason, "work-start");
});

test("throws LeadTimeExceedsUsageWindowError when leadTimeMinutes is not strictly less than usageWindowMinutes", () => {
  const equalConfig: ScheduleConfig = { ...WEEKDAY_CONFIG, leadTimeMinutes: 300 };
  assert.throws(
    () => computePrimerInstantsForDate(equalConfig, { year: 2024, month: 1, day: 15 }, 300),
    LeadTimeExceedsUsageWindowError,
  );

  const largerConfig: ScheduleConfig = { ...WEEKDAY_CONFIG, leadTimeMinutes: 400 };
  assert.throws(
    () => computeNextPrimerRun(largerConfig, new Date("2024-01-15T10:00:00Z"), 300),
    LeadTimeExceedsUsageWindowError,
  );
});

test("a rolling-refresh instant reflects the correct UTC offset across a DST transition", () => {
  // 2024-03-11 is a Monday already in EDT (UTC-4). workStart 09:00 EDT minus
  // 30min lead = 08:30 EDT = 12:30Z; the first rolling-refresh instant is
  // 270 minutes later, still within EDT, so it must also reflect UTC-4.
  const result = computePrimerInstantsForDate(
    WEEKDAY_CONFIG,
    { year: 2024, month: 3, day: 11 },
    SHORT_USAGE_WINDOW_MINUTES,
  );
  const rollingInstant = result.find((instant) => instant.reason === "rolling-refresh");
  assert.ok(rollingInstant, "expected a rolling-refresh instant");
  assert.equal(rollingInstant.instant.toISOString(), "2024-03-11T17:00:00.000Z");
});
