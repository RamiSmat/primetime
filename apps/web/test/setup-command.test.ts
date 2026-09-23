import assert from "node:assert/strict";
import test from "node:test";

import type { ScheduleConfig } from "@primetime/scheduler";

import { setupCommandUnix, setupCommandWindows } from "../lib/setup-command.js";

const SAMPLE_SCHEDULE_CONFIG: ScheduleConfig = {
  timeZone: "America/New_York",
  workStartTime: "09:00",
  leadTimeMinutes: 15,
  activeWeekdays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  deadTimeWindows: [{ startTime: "12:00", endTime: "13:00" }],
};

function decodeScheduleFlag(command: string): unknown {
  const match = /--schedule-base64=([A-Za-z0-9+/=]+)/.exec(command);
  assert.ok(match, `expected a --schedule-base64 flag in: ${command}`);
  return JSON.parse(Buffer.from(match[1]!, "base64").toString("utf8"));
}

test("setupCommandUnix appends a single provider as a trailing positional arg", () => {
  const command = setupCommandUnix(
    "acme/primetime-warmup",
    "https://primetime.example",
    ["codex"],
    SAMPLE_SCHEDULE_CONFIG,
  );
  assert.match(
    command,
    /^curl -fsSL https:\/\/raw\.githubusercontent\.com\/RamiSmat\/primetime\/main\/scripts\/setup-warmup-repo\.sh \| bash -s -- acme\/primetime-warmup https:\/\/primetime\.example codex --schedule-base64=[A-Za-z0-9+/=]+$/,
  );
});

test("setupCommandUnix appends multiple providers as separate trailing args before the schedule flag", () => {
  const command = setupCommandUnix(
    "acme/primetime-warmup",
    "https://primetime.example",
    ["codex", "claude-code"],
    SAMPLE_SCHEDULE_CONFIG,
  );
  assert.match(
    command,
    / acme\/primetime-warmup https:\/\/primetime\.example codex claude-code --schedule-base64=[A-Za-z0-9+/=]+$/,
  );
});

test("setupCommandWindows quotes the repository, URL, every provider, and the schedule flag", () => {
  const command = setupCommandWindows(
    "acme/primetime-warmup",
    "https://primetime.example",
    ["codex", "claude-code"],
    SAMPLE_SCHEDULE_CONFIG,
  );
  assert.match(
    command,
    /^&\(\[scriptblock\]::Create\(\(irm https:\/\/raw\.githubusercontent\.com\/RamiSmat\/primetime\/main\/scripts\/setup-warmup-repo\.ps1\)\)\) "acme\/primetime-warmup" "https:\/\/primetime\.example" "codex" "claude-code" "--schedule-base64=[A-Za-z0-9+/=]+"$/,
  );
});

test("both builders omit provider args entirely when none are given, keeping only the schedule flag", () => {
  const unix = setupCommandUnix(
    "acme/primetime-warmup",
    "https://primetime.example",
    [],
    SAMPLE_SCHEDULE_CONFIG,
  );
  const windows = setupCommandWindows(
    "acme/primetime-warmup",
    "https://primetime.example",
    [],
    SAMPLE_SCHEDULE_CONFIG,
  );
  assert.match(unix, /-- acme\/primetime-warmup https:\/\/primetime\.example --schedule-base64=[A-Za-z0-9+/=]+$/);
  assert.match(
    windows,
    /"acme\/primetime-warmup" "https:\/\/primetime\.example" "--schedule-base64=[A-Za-z0-9+/=]+"$/,
  );
});

test("the embedded schedule flag decodes back to the exact schedule config", () => {
  const command = setupCommandUnix(
    "acme/primetime-warmup",
    "https://primetime.example",
    ["codex"],
    SAMPLE_SCHEDULE_CONFIG,
  );
  assert.deepEqual(decodeScheduleFlag(command), SAMPLE_SCHEDULE_CONFIG);
});
