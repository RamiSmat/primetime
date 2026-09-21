import assert from "node:assert/strict";
import test from "node:test";

import {
  addCalendarDays,
  getZonedCalendarDate,
  getZonedWeekday,
  zonedTimeToUtc,
} from "../src/timezone.js";

test("converts a winter (EST, UTC-5) local time to UTC", () => {
  const instant = zonedTimeToUtc(
    { year: 2024, month: 1, day: 15, hour: 8, minute: 30 },
    "America/New_York",
  );
  assert.equal(instant.toISOString(), "2024-01-15T13:30:00.000Z");
});

test("converts a summer (EDT, UTC-4) local time to UTC", () => {
  const instant = zonedTimeToUtc(
    { year: 2024, month: 7, day: 15, hour: 8, minute: 30 },
    "America/New_York",
  );
  assert.equal(instant.toISOString(), "2024-07-15T12:30:00.000Z");
});

test("reflects the DST transition: the day after spring-forward already uses the new offset", () => {
  // US DST began 2024-03-10 at 02:00 local. 2024-03-11 is already EDT (UTC-4).
  const instant = zonedTimeToUtc(
    { year: 2024, month: 3, day: 11, hour: 9, minute: 0 },
    "America/New_York",
  );
  assert.equal(instant.toISOString(), "2024-03-11T13:00:00.000Z");
});

test("reflects the DST transition: the day before spring-forward still uses the old offset", () => {
  const instant = zonedTimeToUtc(
    { year: 2024, month: 3, day: 8, hour: 9, minute: 0 },
    "America/New_York",
  );
  assert.equal(instant.toISOString(), "2024-03-08T14:00:00.000Z");
});

test("gets the correct local weekday for a zone ahead of UTC", () => {
  // 2024-01-01T20:00:00Z is 2024-01-02T05:00 JST (UTC+9, no DST) — a Tuesday.
  const weekday = getZonedWeekday(new Date("2024-01-01T20:00:00Z"), "Asia/Tokyo");
  assert.equal(weekday, "tuesday");
});

test("gets the correct local calendar date across a UTC day boundary", () => {
  const date = getZonedCalendarDate(new Date("2024-01-01T20:00:00Z"), "Asia/Tokyo");
  assert.deepEqual(date, { year: 2024, month: 1, day: 2 });
});

test("adds calendar days across a month boundary", () => {
  assert.deepEqual(addCalendarDays({ year: 2024, month: 1, day: 31 }, 1), {
    year: 2024,
    month: 2,
    day: 1,
  });
});

test("adds calendar days across a year boundary", () => {
  assert.deepEqual(addCalendarDays({ year: 2024, month: 12, day: 31 }, 1), {
    year: 2025,
    month: 1,
    day: 1,
  });
});
