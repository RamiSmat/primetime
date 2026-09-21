import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLoginStatusArgs,
  buildPrimerArgs,
  buildVersionArgs,
  CODEX_PRIMER_PROMPT,
} from "../src/codex/command.js";

test("builds the version detection args", () => {
  assert.deepEqual(buildVersionArgs(), ["--version"]);
});

test("builds the login status args", () => {
  assert.deepEqual(buildLoginStatusArgs(), ["login", "status"]);
});

test("builds the primer args with every required safety flag", () => {
  const args = buildPrimerArgs("/tmp/primetime-codex-abc123");

  assert.deepEqual(args, [
    "exec",
    "--ephemeral",
    "--ignore-user-config",
    "--ignore-rules",
    "--sandbox",
    "read-only",
    "--skip-git-repo-check",
    "--color",
    "never",
    "-c",
    "shell_environment_policy.inherit=none",
    "-C",
    "/tmp/primetime-codex-abc123",
    CODEX_PRIMER_PROMPT,
  ]);
});

test("the primer prompt never asks the model to use tools or inspect files", () => {
  assert.match(CODEX_PRIMER_PROMPT, /reply only with ok/i);
  assert.match(CODEX_PRIMER_PROMPT, /do not use tools/i);
});
