import assert from "node:assert/strict";
import test from "node:test";

import { setupCommandUnix, setupCommandWindows } from "../lib/setup-command.js";

test("setupCommandUnix appends a single provider as a trailing positional arg", () => {
  const command = setupCommandUnix("acme/primetime-warmup", "https://primetime.example", ["codex"]);
  assert.equal(
    command,
    "curl -fsSL https://raw.githubusercontent.com/RamiSmat/primetime/main/scripts/setup-warmup-repo.sh | bash -s -- acme/primetime-warmup https://primetime.example codex",
  );
});

test("setupCommandUnix appends multiple providers as separate trailing args", () => {
  const command = setupCommandUnix("acme/primetime-warmup", "https://primetime.example", [
    "codex",
    "claude-code",
  ]);
  assert.match(command, / acme\/primetime-warmup https:\/\/primetime\.example codex claude-code$/);
});

test("setupCommandWindows quotes the repository, URL, and every provider", () => {
  const command = setupCommandWindows("acme/primetime-warmup", "https://primetime.example", [
    "codex",
    "claude-code",
  ]);
  assert.equal(
    command,
    '&([scriptblock]::Create((irm https://raw.githubusercontent.com/RamiSmat/primetime/main/scripts/setup-warmup-repo.ps1))) "acme/primetime-warmup" "https://primetime.example" "codex" "claude-code"',
  );
});

test("both builders omit provider args entirely when none are given", () => {
  const unix = setupCommandUnix("acme/primetime-warmup", "https://primetime.example", []);
  const windows = setupCommandWindows("acme/primetime-warmup", "https://primetime.example", []);
  assert.match(unix, /-- acme\/primetime-warmup https:\/\/primetime\.example$/);
  assert.match(windows, /"acme\/primetime-warmup" "https:\/\/primetime\.example"$/);
});
