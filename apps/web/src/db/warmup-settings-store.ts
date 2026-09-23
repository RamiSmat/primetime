import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import type { ScheduleConfig } from "@primetime/scheduler";

import { warmupSettings } from "./schema";

export interface WarmupSettingsRecord {
  readonly accountLogin: string;
  readonly scheduleConfig: ScheduleConfig;
  readonly subscriptionCounts: Readonly<Record<string, number>>;
}

/**
 * Persists each GitHub account's saved warmup schedule and per-provider
 * subscription counts. The API route is the only writer, and it always
 * validates a `scheduleConfig` via `@primetime/scheduler#parseScheduleConfig`
 * before it ever reaches this store.
 */
export interface WarmupSettingsStore {
  getSettings(accountLogin: string): Promise<WarmupSettingsRecord | undefined>;
  saveSettings(record: WarmupSettingsRecord): Promise<void>;
}

/** Drizzle-backed implementation for production, over Neon's serverless HTTP driver. */
export class DrizzleWarmupSettingsStore implements WarmupSettingsStore {
  private readonly db: ReturnType<typeof drizzle>;

  public constructor(databaseUrl: string) {
    this.db = drizzle(neon(databaseUrl));
  }

  public async getSettings(accountLogin: string): Promise<WarmupSettingsRecord | undefined> {
    const rows = await this.db
      .select({
        accountLogin: warmupSettings.accountLogin,
        scheduleConfig: warmupSettings.scheduleConfig,
        subscriptionCounts: warmupSettings.subscriptionCounts,
      })
      .from(warmupSettings)
      .where(eq(warmupSettings.accountLogin, accountLogin))
      .limit(1);

    return rows[0];
  }

  public async saveSettings(record: WarmupSettingsRecord): Promise<void> {
    await this.db
      .insert(warmupSettings)
      .values({
        accountLogin: record.accountLogin,
        scheduleConfig: record.scheduleConfig,
        subscriptionCounts: record.subscriptionCounts,
      })
      .onConflictDoUpdate({
        target: warmupSettings.accountLogin,
        set: {
          scheduleConfig: record.scheduleConfig,
          subscriptionCounts: record.subscriptionCounts,
          updatedAt: new Date(),
        },
      });
  }
}

/** Plain in-memory fake for tests — route-handler tests never need a real Postgres connection. */
export class InMemoryWarmupSettingsStore implements WarmupSettingsStore {
  private readonly records = new Map<string, WarmupSettingsRecord>();

  public async getSettings(accountLogin: string): Promise<WarmupSettingsRecord | undefined> {
    return this.records.get(accountLogin);
  }

  public async saveSettings(record: WarmupSettingsRecord): Promise<void> {
    this.records.set(record.accountLogin, record);
  }
}

let singleton: WarmupSettingsStore | undefined;

/** Lazily builds the process-wide store from `DATABASE_URL`, so route handlers share one connection. */
export function getWarmupSettingsStore(): WarmupSettingsStore {
  if (!singleton) {
    const databaseUrl = process.env["DATABASE_URL"];
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not set.");
    }
    singleton = new DrizzleWarmupSettingsStore(databaseUrl);
  }
  return singleton;
}
