import { parseScheduleConfig, type ScheduleConfig } from "@primetime/scheduler";
import { PrimeTimeError } from "@primetime/shared";

import type { SessionPayload } from "../auth/session";
import type { WarmupSettingsStore } from "../db/warmup-settings-store";

/** Used whenever an account has never saved warmup settings before. */
export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  timeZone: "UTC",
  workStartTime: "09:00",
  leadTimeMinutes: 10,
  activeWeekdays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  deadTimeWindows: [],
};

export const DEFAULT_SUBSCRIPTION_COUNTS: Readonly<Record<string, number>> = {};

export interface WarmupSettingsHandlerOptions {
  /** Resolved by the route adapter via `getCurrentUser()` — passed in, not read here, so this is testable with a plain `Request` and a fake session. */
  readonly user: SessionPayload | undefined;
  readonly store: WarmupSettingsStore;
}

export async function handleGetWarmupSettings(
  options: WarmupSettingsHandlerOptions,
): Promise<Response> {
  if (!options.user) {
    return Response.json({ error: "not signed in" }, { status: 401 });
  }

  const record = await options.store.getSettings(options.user.login);
  return Response.json({
    scheduleConfig: record?.scheduleConfig ?? DEFAULT_SCHEDULE_CONFIG,
    subscriptionCounts: record?.subscriptionCounts ?? DEFAULT_SUBSCRIPTION_COUNTS,
  });
}

class InvalidWarmupSettingsError extends Error {}

/**
 * `subscriptionCounts` is purely inert data (see the doc comment on the
 * `warmup_settings` table) — this only checks that each value is a
 * sensible count, never against the provider registry.
 */
function parseSubscriptionCounts(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new InvalidWarmupSettingsError("subscriptionCounts must be an object.");
  }

  const counts: Record<string, number> = {};
  for (const [providerId, count] of Object.entries(value as Record<string, unknown>)) {
    if (typeof count !== "number" || !Number.isInteger(count) || count < 0) {
      throw new InvalidWarmupSettingsError(
        `subscriptionCounts.${providerId} must be a non-negative integer.`,
      );
    }
    counts[providerId] = count;
  }
  return counts;
}

export async function handleSaveWarmupSettings(
  request: Request,
  options: WarmupSettingsHandlerOptions,
): Promise<Response> {
  if (!options.user) {
    return Response.json({ error: "not signed in" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "request body must be valid JSON." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "request body must be an object." }, { status: 400 });
  }
  const candidate = body as Record<string, unknown>;

  let scheduleConfig: ScheduleConfig;
  try {
    scheduleConfig = parseScheduleConfig(candidate.scheduleConfig);
  } catch (error) {
    if (error instanceof PrimeTimeError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  let subscriptionCounts: Record<string, number>;
  try {
    subscriptionCounts = parseSubscriptionCounts(candidate.subscriptionCounts ?? {});
  } catch (error) {
    if (error instanceof InvalidWarmupSettingsError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  await options.store.saveSettings({
    accountLogin: options.user.login,
    scheduleConfig,
    subscriptionCounts,
  });

  return Response.json({ scheduleConfig, subscriptionCounts });
}
