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
