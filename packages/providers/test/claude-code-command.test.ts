import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAuthStatusArgs,
  buildPrimerArgs,
  buildVersionArgs,
  CLAUDE_CODE_PRIMER_PROMPT,
} from "../src/claude-code/command.js";

test("builds the version detection args", () => {
  assert.deepEqual(buildVersionArgs(), ["--version"]);
});

test("builds the auth status args", () => {
  assert.deepEqual(buildAuthStatusArgs(), ["auth", "status"]);
});

test("builds the primer args with every required safety flag", () => {
  const args = buildPrimerArgs();

  assert.deepEqual(args, [
    "-p",
    CLAUDE_CODE_PRIMER_PROMPT,
    "--disallowedTools",
    "*",
    "--permission-mode",
    "plan",
    "--permission-prompts",
    "none",
    "--max-turns",
    "1",
    "--output-format",
    "json",
    "--no-session-persistence",
  ]);
});

test("the primer prompt never asks the model to use tools or inspect files", () => {
  assert.match(CLAUDE_CODE_PRIMER_PROMPT, /reply only with ok/i);
  assert.match(CLAUDE_CODE_PRIMER_PROMPT, /do not use tools/i);
});
