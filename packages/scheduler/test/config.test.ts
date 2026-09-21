import assert from "node:assert/strict";
import test from "node:test";

import { InvalidScheduleConfigError, parseScheduleConfig, parseWorkStartTime } from "../src/config.js";

const VALID_CONFIG = {
  timeZone: "America/New_York",
  workStartTime: "09:00",
  leadTimeMinutes: 30,
  activeWeekdays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
};

test("parses a valid configuration", () => {
  assert.deepEqual(parseScheduleConfig(VALID_CONFIG), VALID_CONFIG);
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
