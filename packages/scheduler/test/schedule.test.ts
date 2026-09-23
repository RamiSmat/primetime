import assert from "node:assert/strict";
import test from "node:test";

import {
  computeNextPrimerRun,
  computePrimerInstantsForDate,
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

test("computes today's primer time when it is still ahead, in winter (EST)", () => {
  // 2024-01-15 is a Monday. now = 10:00Z = 05:00 EST, well before 08:30 EST primer time.
  const result = computeNextPrimerRun(WEEKDAY_CONFIG, new Date("2024-01-15T10:00:00Z"));
  assert.equal(result.toISOString(), "2024-01-15T13:30:00.000Z");
});

test("computes today's primer time when it is still ahead, in summer (EDT)", () => {
  // 2024-07-15 is a Monday. now = 10:00Z = 06:00 EDT, before 08:30 EDT primer time.
  const result = computeNextPrimerRun(WEEKDAY_CONFIG, new Date("2024-07-15T10:00:00Z"));
  assert.equal(result.toISOString(), "2024-07-15T12:30:00.000Z");
});

test("rolls over to the next active weekday once today's primer time has passed", () => {
  // 2024-01-15 is a Monday; by 20:00Z (15:00 EST) the 08:30 EST primer time is long past.
  // The next active weekday is Tuesday 2024-01-16.
  const result = computeNextPrimerRun(WEEKDAY_CONFIG, new Date("2024-01-15T20:00:00Z"));
  assert.equal(result.toISOString(), "2024-01-16T13:30:00.000Z");
});

test("skips inactive weekdays to find the next active one", () => {
  // 2024-01-19 is a Friday; with only weekdays active, next primer is Monday 2024-01-22.
  const result = computeNextPrimerRun(WEEKDAY_CONFIG, new Date("2024-01-19T20:00:00Z"));
  assert.equal(result.toISOString(), "2024-01-22T13:30:00.000Z");
});

test("crosses the spring-forward DST transition correctly when rolling over a weekend", () => {
  // 2024-03-08 is a Friday, well past that day's primer time (EST, UTC-5).
  // DST begins 2024-03-10. The next active weekday, Monday 2024-03-11, is
  // already EDT (UTC-4), so its primer instant must reflect the new offset.
  const result = computeNextPrimerRun(WEEKDAY_CONFIG, new Date("2024-03-08T20:00:00Z"));
  assert.equal(result.toISOString(), "2024-03-11T12:30:00.000Z");
});

test("wraps around a full week when only one weekday is active", () => {
  const fridayOnly: ScheduleConfig = { ...WEEKDAY_CONFIG, activeWeekdays: ["friday"] };
  // 2024-01-19 is a Friday, after that day's primer time; next Friday is 2024-01-26.
  const result = computeNextPrimerRun(fridayOnly, new Date("2024-01-19T20:00:00Z"));
  assert.equal(result.toISOString(), "2024-01-26T13:30:00.000Z");
});

test("treats a candidate exactly at now as already passed (strictly-after semantics)", () => {
  const firstRun = computeNextPrimerRun(WEEKDAY_CONFIG, new Date("2024-01-15T10:00:00Z"));
  // Re-running with `now` set to exactly the previously computed primer
  // instant must not return that same instant again — it must advance.
  const secondRun = computeNextPrimerRun(WEEKDAY_CONFIG, firstRun);
  assert.equal(secondRun.toISOString(), "2024-01-16T13:30:00.000Z");
});

test("recalculates correctly as the current time advances (schedule updates)", () => {
  const morning = computeNextPrimerRun(WEEKDAY_CONFIG, new Date("2024-01-15T10:00:00Z"));
  const afternoon = computeNextPrimerRun(WEEKDAY_CONFIG, new Date("2024-01-15T18:00:00Z"));
  assert.equal(morning.toISOString(), "2024-01-15T13:30:00.000Z");
  assert.equal(afternoon.toISOString(), "2024-01-16T13:30:00.000Z");
});

test("applies a large lead time correctly", () => {
  // 90 minutes before 09:00 EST is 07:30 EST = 12:30Z.
  const longLeadTime: ScheduleConfig = { ...WEEKDAY_CONFIG, leadTimeMinutes: 90 };
  const result = computeNextPrimerRun(longLeadTime, new Date("2024-01-15T10:00:00Z"));
  assert.equal(result.toISOString(), "2024-01-15T12:30:00.000Z");
});

test("throws when there are no active weekdays", () => {
  const noActiveDays: ScheduleConfig = { ...WEEKDAY_CONFIG, activeWeekdays: [] };
  assert.throws(
    () => computeNextPrimerRun(noActiveDays, new Date("2024-01-15T10:00:00Z")),
    NoActivePrimerWindowError,
  );
});

test("computePrimerInstantsForDate returns nothing on an inactive weekday", () => {
  // 2024-01-14 is a Sunday, not in WEEKDAY_CONFIG's activeWeekdays.
  const result = computePrimerInstantsForDate(WEEKDAY_CONFIG, { year: 2024, month: 1, day: 14 });
  assert.deepEqual(result, []);
});

test("computePrimerInstantsForDate returns just the work-start instant with no dead-time windows", () => {
  const result = computePrimerInstantsForDate(WEEKDAY_CONFIG, { year: 2024, month: 1, day: 15 });
  assert.equal(result.length, 1);
  assert.equal(result[0]!.reason, "work-start");
  assert.equal(result[0]!.instant.toISOString(), "2024-01-15T13:30:00.000Z");
});

test("computePrimerInstantsForDate adds a re-prime instant before each dead-time window ends", () => {
  const config: ScheduleConfig = {
    ...WEEKDAY_CONFIG,
    deadTimeWindows: [{ startTime: "12:00", endTime: "13:00" }],
  };
  const result = computePrimerInstantsForDate(config, { year: 2024, month: 1, day: 15 });
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
  const result = computePrimerInstantsForDate(config, { year: 2024, month: 3, day: 11 });
  assert.equal(result[1]!.instant.toISOString(), "2024-03-11T17:30:00.000Z");
});

test("computeNextPrimerRun advances to a same-day dead-time-window re-prime rather than skipping to the next day", () => {
  const config: ScheduleConfig = {
    ...WEEKDAY_CONFIG,
    deadTimeWindows: [{ startTime: "12:00", endTime: "13:00" }],
  };
  // 14:00Z = 09:00 EST: today's work-start primer (13:30Z) has passed, but the
  // dead-time-window re-prime (17:30Z) has not.
  const result = computeNextPrimerRun(config, new Date("2024-01-15T14:00:00Z"));
  assert.equal(result.toISOString(), "2024-01-15T17:30:00.000Z");
});

test("computeNextPrimerRun behaves exactly as before when deadTimeWindows is empty", () => {
  const result = computeNextPrimerRun(WEEKDAY_CONFIG, new Date("2024-01-15T10:00:00Z"));
  assert.equal(result.toISOString(), "2024-01-15T13:30:00.000Z");
});
