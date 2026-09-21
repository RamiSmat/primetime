import assert from "node:assert/strict";
import test from "node:test";

import { CliUsageError, parseCliArguments } from "../src/arguments.js";

test("parses the prime command and provider", () => {
  assert.deepEqual(parseCliArguments(["prime", "codex"]), {
    command: "prime",
    provider: "codex",
  });
});

test("rejects a missing provider", () => {
  assert.throws(() => parseCliArguments(["prime"]), CliUsageError);
});

test("rejects unsupported command shapes", () => {
  assert.throws(
    () => parseCliArguments(["prime", "codex", "extra"]),
    CliUsageError,
  );
  assert.throws(() => parseCliArguments(["setup", "codex"]), CliUsageError);
});

test("parses the schedule next command and config path", () => {
  assert.deepEqual(parseCliArguments(["schedule", "next", "./schedule.json"]), {
    command: "schedule-next",
    configPath: "./schedule.json",
  });
});

test("rejects a schedule next command missing a config path", () => {
  assert.throws(() => parseCliArguments(["schedule", "next"]), CliUsageError);
});

test("rejects an unsupported schedule subcommand", () => {
  assert.throws(
    () => parseCliArguments(["schedule", "later", "./schedule.json"]),
    CliUsageError,
  );
});

test("rejects a schedule next command with extra arguments", () => {
  assert.throws(
    () => parseCliArguments(["schedule", "next", "./schedule.json", "extra"]),
    CliUsageError,
  );
});
