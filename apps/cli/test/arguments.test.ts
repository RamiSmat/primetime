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
