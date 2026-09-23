import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { InvalidScheduleConfigError } from "@primetime/scheduler";

import { ScheduleConfigFileError, readScheduleConfigFile } from "../src/schedule.js";

const VALID_CONFIG = {
  timeZone: "America/New_York",
  workStartTime: "09:00",
  leadTimeMinutes: 30,
  activeWeekdays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
};

async function withTempFile(
  contents: string,
  run: (filePath: string) => Promise<void>,
): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "primetime-cli-test-"));
  const filePath = join(dir, "schedule.json");
  try {
    await writeFile(filePath, contents, "utf8");
    await run(filePath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("reads and parses a valid schedule config file", async () => {
  await withTempFile(JSON.stringify(VALID_CONFIG), async (filePath) => {
    const config = await readScheduleConfigFile(filePath);
    assert.deepEqual(config, { ...VALID_CONFIG, deadTimeWindows: [] });
  });
});

test("reports a clear error for a missing config file", async () => {
  await assert.rejects(
    readScheduleConfigFile(join(tmpdir(), "primetime-does-not-exist", "schedule.json")),
    ScheduleConfigFileError,
  );
});

test("reports a clear error for invalid JSON", async () => {
  await withTempFile("{ not valid json", async (filePath) => {
    await assert.rejects(readScheduleConfigFile(filePath), ScheduleConfigFileError);
  });
});

test("surfaces schedule validation errors for well-formed JSON with an invalid schedule", async () => {
  await withTempFile(JSON.stringify({ ...VALID_CONFIG, activeWeekdays: [] }), async (filePath) => {
    await assert.rejects(readScheduleConfigFile(filePath), InvalidScheduleConfigError);
  });
});
