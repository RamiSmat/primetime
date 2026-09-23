import assert from "node:assert/strict";
import test from "node:test";

import type { ScheduleConfig } from "@primetime/scheduler";

import type { SessionPayload } from "../src/auth/session.js";
import { InMemoryWarmupSettingsStore } from "../src/db/warmup-settings-store.js";
import {
  DEFAULT_SCHEDULE_CONFIG,
  handleGetWarmupSettings,
  handleSaveWarmupSettings,
} from "../src/settings/warmup-settings-handler.js";

const FIXED_USER: SessionPayload = {
  login: "octocat",
  userId: 1,
  avatarUrl: "https://example.invalid/avatar.png",
};

const VALID_SCHEDULE_CONFIG: ScheduleConfig = {
  timeZone: "America/New_York",
  workStartTime: "09:00",
  leadTimeMinutes: 15,
  activeWeekdays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  deadTimeWindows: [{ startTime: "12:00", endTime: "13:00" }],
};

function saveRequest(body: unknown): Request {
  return new Request("https://primetime.example/api/settings/warmup", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("GET rejects when no user is signed in", async () => {
  const store = new InMemoryWarmupSettingsStore();
  const response = await handleGetWarmupSettings({ user: undefined, store });
  assert.equal(response.status, 401);
});

test("PUT rejects when no user is signed in", async () => {
  const store = new InMemoryWarmupSettingsStore();
  const response = await handleSaveWarmupSettings(saveRequest({}), { user: undefined, store });
  assert.equal(response.status, 401);
});

test("GET returns defaults when nothing has been saved yet", async () => {
  const store = new InMemoryWarmupSettingsStore();
  const response = await handleGetWarmupSettings({ user: FIXED_USER, store });

  assert.equal(response.status, 200);
  const json = (await response.json()) as { scheduleConfig: ScheduleConfig; subscriptionCounts: Record<string, number> };
  assert.deepEqual(json.scheduleConfig, DEFAULT_SCHEDULE_CONFIG);
  assert.deepEqual(json.subscriptionCounts, {});
});

test("PUT saves valid settings, and a subsequent GET returns them", async () => {
  const store = new InMemoryWarmupSettingsStore();

  const putResponse = await handleSaveWarmupSettings(
    saveRequest({ scheduleConfig: VALID_SCHEDULE_CONFIG, subscriptionCounts: { codex: 2 } }),
    { user: FIXED_USER, store },
  );
  assert.equal(putResponse.status, 200);

  const getResponse = await handleGetWarmupSettings({ user: FIXED_USER, store });
  assert.equal(getResponse.status, 200);
  const json = (await getResponse.json()) as { scheduleConfig: ScheduleConfig; subscriptionCounts: Record<string, number> };
  assert.deepEqual(json.scheduleConfig, VALID_SCHEDULE_CONFIG);
  assert.deepEqual(json.subscriptionCounts, { codex: 2 });
});

test("PUT defaults subscriptionCounts to an empty object when omitted", async () => {
  const store = new InMemoryWarmupSettingsStore();
  const response = await handleSaveWarmupSettings(saveRequest({ scheduleConfig: VALID_SCHEDULE_CONFIG }), {
    user: FIXED_USER,
    store,
  });

  assert.equal(response.status, 200);
  const json = (await response.json()) as { subscriptionCounts: Record<string, number> };
  assert.deepEqual(json.subscriptionCounts, {});
});

test("PUT rejects an invalid schedule config with the underlying validation message", async () => {
  const store = new InMemoryWarmupSettingsStore();
  const response = await handleSaveWarmupSettings(
    saveRequest({ scheduleConfig: { ...VALID_SCHEDULE_CONFIG, activeWeekdays: [] } }),
    { user: FIXED_USER, store },
  );

  assert.equal(response.status, 400);
  const json = (await response.json()) as { error: string };
  assert.match(json.error, /Invalid schedule configuration/);
});

test("PUT rejects a malformed JSON body", async () => {
  const store = new InMemoryWarmupSettingsStore();
  const request = new Request("https://primetime.example/api/settings/warmup", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: "{ not valid json",
  });
  const response = await handleSaveWarmupSettings(request, { user: FIXED_USER, store });
  assert.equal(response.status, 400);
});

test("PUT rejects a negative subscription count", async () => {
  const store = new InMemoryWarmupSettingsStore();
  const response = await handleSaveWarmupSettings(
    saveRequest({ scheduleConfig: VALID_SCHEDULE_CONFIG, subscriptionCounts: { codex: -1 } }),
    { user: FIXED_USER, store },
  );

  assert.equal(response.status, 400);
  const json = (await response.json()) as { error: string };
  assert.match(json.error, /non-negative integer/);
});

test("PUT rejects a non-object subscriptionCounts value", async () => {
  const store = new InMemoryWarmupSettingsStore();
  const response = await handleSaveWarmupSettings(
    saveRequest({ scheduleConfig: VALID_SCHEDULE_CONFIG, subscriptionCounts: "not an object" }),
    { user: FIXED_USER, store },
  );

  assert.equal(response.status, 400);
});
