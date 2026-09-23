import assert from "node:assert/strict";
import test from "node:test";

import {
  InvalidScheduleConfigError,
  parseDeadTimeWindow,
  parseScheduleConfig,
  parseWorkStartTime,
} from "../src/config.js";

const VALID_CONFIG = {
  timeZone: "America/New_York",
  workStartTime: "09:00",
  leadTimeMinutes: 30,
  activeWeekdays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
};

test("parses a valid configuration, defaulting deadTimeWindows to an empty array", () => {
  assert.deepEqual(parseScheduleConfig(VALID_CONFIG), { ...VALID_CONFIG, deadTimeWindows: [] });
});

test("parses a valid configuration with dead-time windows", () => {
  const withWindows = {
    ...VALID_CONFIG,
    deadTimeWindows: [
      { startTime: "12:00", endTime: "13:00" },
      { startTime: "15:00", endTime: "15:15" },
    ],
  };
  assert.deepEqual(parseScheduleConfig(withWindows), withWindows);
});

test("parses a single dead-time window", () => {
  assert.deepEqual(parseDeadTimeWindow({ startTime: "12:00", endTime: "13:00" }), {
    startTime: "12:00",
    endTime: "13:00",
  });
});

test("rejects a malformed dead-time window", () => {
  assert.throws(() => parseDeadTimeWindow(null), InvalidScheduleConfigError);
  assert.throws(() => parseDeadTimeWindow({ startTime: "12:00" }), InvalidScheduleConfigError);
  assert.throws(
    () => parseDeadTimeWindow({ startTime: "not-a-time", endTime: "13:00" }),
    InvalidScheduleConfigError,
  );
  assert.throws(
    () => parseDeadTimeWindow({ startTime: "13:00", endTime: "13:00" }),
    InvalidScheduleConfigError,
    "endTime equal to startTime must be rejected",
  );
  assert.throws(
    () => parseDeadTimeWindow({ startTime: "13:00", endTime: "12:00" }),
    InvalidScheduleConfigError,
    "endTime before startTime must be rejected",
  );
});

test("rejects a non-array deadTimeWindows field", () => {
  assert.throws(
    () => parseScheduleConfig({ ...VALID_CONFIG, deadTimeWindows: { startTime: "12:00", endTime: "13:00" } }),
    InvalidScheduleConfigError,
  );
});

test("rejects overlapping dead-time windows", () => {
  assert.throws(
    () =>
      parseScheduleConfig({
        ...VALID_CONFIG,
        deadTimeWindows: [
          { startTime: "12:00", endTime: "13:00" },
          { startTime: "12:30", endTime: "14:00" },
        ],
      }),
    InvalidScheduleConfigError,
  );
});

test("accepts back-to-back (touching, non-overlapping) dead-time windows", () => {
  const config = {
    ...VALID_CONFIG,
    deadTimeWindows: [
      { startTime: "12:00", endTime: "13:00" },
      { startTime: "13:00", endTime: "13:30" },
    ],
  };
  assert.deepEqual(parseScheduleConfig(config), config);
});

test("parses a work start time into hour and minute", () => {
  assert.deepEqual(parseWorkStartTime("09:05"), { hour: 9, minute: 5 });
  assert.deepEqual(parseWorkStartTime("23:59"), { hour: 23, minute: 59 });
  assert.deepEqual(parseWorkStartTime("00:00"), { hour: 0, minute: 0 });
});

test("rejects a non-object configuration", () => {
  assert.throws(() => parseScheduleConfig(null), InvalidScheduleConfigError);
  assert.throws(() => parseScheduleConfig("not an object"), InvalidScheduleConfigError);
});

test("rejects an unrecognized time zone", () => {
  assert.throws(
    () => parseScheduleConfig({ ...VALID_CONFIG, timeZone: "Nowhere/Fake" }),
    InvalidScheduleConfigError,
  );
});

test("rejects a malformed work start time", () => {
  for (const value of ["9:00", "09:60", "24:00", "not-a-time", ""]) {
    assert.throws(
      () => parseScheduleConfig({ ...VALID_CONFIG, workStartTime: value }),
      InvalidScheduleConfigError,
      `expected "${value}" to be rejected`,
    );
  }
});

test("rejects a negative or non-integer lead time", () => {
  for (const value of [-1, 1.5, Number.NaN, "30"]) {
    assert.throws(
      () => parseScheduleConfig({ ...VALID_CONFIG, leadTimeMinutes: value }),
      InvalidScheduleConfigError,
    );
  }
});

test("rejects empty or invalid active weekdays", () => {
  assert.throws(
    () => parseScheduleConfig({ ...VALID_CONFIG, activeWeekdays: [] }),
    InvalidScheduleConfigError,
  );
  assert.throws(
    () => parseScheduleConfig({ ...VALID_CONFIG, activeWeekdays: ["funday"] }),
    InvalidScheduleConfigError,
  );
  assert.throws(
    () => parseScheduleConfig({ ...VALID_CONFIG, activeWeekdays: "monday" }),
    InvalidScheduleConfigError,
  );
});

test("does not echo unrelated fields and rejects a missing required field", () => {
  const { timeZone, ...withoutTimeZone } = VALID_CONFIG;
  void timeZone;
  assert.throws(() => parseScheduleConfig(withoutTimeZone), InvalidScheduleConfigError);
});
