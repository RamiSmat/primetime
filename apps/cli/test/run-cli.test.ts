import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runCli } from "../src/index.js";
import type { CliIo } from "../src/index.js";

const VALID_CONFIG = {
  timeZone: "America/New_York",
  workStartTime: "09:00",
  leadTimeMinutes: 30,
  activeWeekdays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
};

function fakeIo(input = ""): CliIo & { output: string[]; errors: string[] } {
  const output: string[] = [];
  const errors: string[] = [];
  return {
    output,
    errors,
    writeOutput: (message: string) => output.push(message),
    writeError: (message: string) => errors.push(message),
    readInput: () => Promise.resolve(input),
  };
}

async function withTempConfigFile(
  contents: string,
  run: (filePath: string) => Promise<void>,
): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "primetime-run-cli-test-"));
  const filePath = join(dir, "schedule.json");
  try {
    await writeFile(filePath, contents, "utf8");
    await run(filePath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("schedule next reports the next primer run as an ISO instant", async () => {
  await withTempConfigFile(JSON.stringify(VALID_CONFIG), async (filePath) => {
    const io = fakeIo();
    const exitCode = await runCli(["schedule", "next", filePath], io);

    assert.equal(exitCode, 0);
    assert.equal(io.errors.length, 0);
    assert.equal(io.output.length, 1);
    assert.match(io.output[0]!, /^Next primer run: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

test("schedule next reports a clear error and exit code 1 for a missing config file", async () => {
  const io = fakeIo();
  const exitCode = await runCli(
    ["schedule", "next", join(tmpdir(), "primetime-missing-dir", "schedule.json")],
    io,
  );

  assert.equal(exitCode, 1);
  assert.equal(io.output.length, 0);
  assert.equal(io.errors.length, 1);
  assert.match(io.errors[0]!, /could not be read/);
});

test("setup github-secrets-pat reports a clear error for empty stdin, without calling gh", async () => {
  const io = fakeIo("   \n");
  const exitCode = await runCli(["setup", "github-secrets-pat"], io);

  assert.equal(exitCode, 1);
  assert.equal(io.output.length, 0);
  assert.deepEqual(io.errors, ["No PAT value was provided on stdin."]);
});

test("schedule next reports a clear error for an invalid schedule", async () => {
  await withTempConfigFile(
    JSON.stringify({ ...VALID_CONFIG, activeWeekdays: [] }),
    async (filePath) => {
      const io = fakeIo();
      const exitCode = await runCli(["schedule", "next", filePath], io);

      assert.equal(exitCode, 1);
      assert.equal(io.output.length, 0);
      assert.match(io.errors[0]!, /Invalid schedule configuration/);
    },
  );
});

const ALL_WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const UTC_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long" });

function utcWeekdayName(date: Date): string {
  return UTC_WEEKDAY_FORMATTER.format(date).toLowerCase();
}

test("schedule due exits 0 and reports due when now is within tolerance of a primer instant", async () => {
  // workStartTime is set to "now"'s own UTC clock time with a zero lead
  // time, so the computed primer instant is (near enough) "now" itself,
  // regardless of when this test actually runs.
  const now = new Date();
  const config = {
    timeZone: "UTC",
    workStartTime: `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`,
    leadTimeMinutes: 0,
    activeWeekdays: [utcWeekdayName(now)],
  };
  await withTempConfigFile(JSON.stringify(config), async (filePath) => {
    const io = fakeIo();
    const exitCode = await runCli(["schedule", "due", filePath, "--tolerance-minutes", "2"], io);

    assert.equal(exitCode, 0);
    assert.equal(io.errors.length, 0);
    assert.equal(io.output.length, 1);
    assert.match(io.output[0]!, /^Primer is due/);
  });
});

test("schedule due exits 2 and reports not due when no active weekday falls near now", async () => {
  // Only a weekday that is neither yesterday, today, nor tomorrow (in
  // UTC) is active, so `isPrimerDue`'s 3-day check can never find a
  // matching primer instant, regardless of when this test actually runs.
  const now = new Date();
  const nearbyWeekdays = new Set([
    utcWeekdayName(new Date(now.getTime() - 86_400_000)),
    utcWeekdayName(now),
    utcWeekdayName(new Date(now.getTime() + 86_400_000)),
  ]);
  const safeWeekday = ALL_WEEKDAYS.find((weekday) => !nearbyWeekdays.has(weekday));
  assert.ok(safeWeekday, "expected at least one weekday outside the yesterday/today/tomorrow window");

  const config = {
    timeZone: "UTC",
    workStartTime: "12:00",
    leadTimeMinutes: 0,
    activeWeekdays: [safeWeekday],
  };
  await withTempConfigFile(JSON.stringify(config), async (filePath) => {
    const io = fakeIo();
    const exitCode = await runCli(["schedule", "due", filePath], io);

    assert.equal(exitCode, 2);
    assert.equal(io.errors.length, 0);
    assert.equal(io.output.length, 1);
    assert.match(io.output[0]!, /^Primer is not due/);
  });
});

test("schedule due reports a clear error and exit code 1 for an invalid schedule", async () => {
  await withTempConfigFile(
    JSON.stringify({ ...VALID_CONFIG, activeWeekdays: [] }),
    async (filePath) => {
      const io = fakeIo();
      const exitCode = await runCli(["schedule", "due", filePath], io);

      assert.equal(exitCode, 1);
      assert.equal(io.output.length, 0);
      assert.match(io.errors[0]!, /Invalid schedule configuration/);
    },
  );
});
