import { integer, jsonb, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

import type { ScheduleConfig } from "@primetime/scheduler";

/**
 * One row per GitHub App installation (an account installing the App onto
 * some subset of its repositories). Populated and kept in sync entirely
 * from webhook events — this table never stores anything the App itself
 * wasn't told by GitHub.
 */
export const githubInstallations = pgTable("github_installations", {
  id: serial("id").primaryKey(),
  installationId: integer("installation_id").notNull().unique(),
  accountLogin: text("account_login").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * The repositories each installation currently covers. Kept as its own
 * table (rather than a column on `githubInstallations`) because the
 * `installation_repositories` webhook event adds and removes repositories
 * from an installation independently of the installation record itself.
 */
export const installationRepositories = pgTable(
  "installation_repositories",
  {
    id: serial("id").primaryKey(),
    installationId: integer("installation_id").notNull(),
    repositoryFullName: text("repository_full_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.installationId, table.repositoryFullName)],
);

/**
 * One row per GitHub account: their saved warmup schedule (work-start time,
 * dead-time windows, ...) plus how many subscriptions they have per
 * provider. Stored as one `ScheduleConfig`-shaped JSON blob rather than
 * exploded columns, since `@primetime/scheduler#parseScheduleConfig` is
 * already the one authoritative shape/validator for it — this table's API
 * route is the only writer, and it always validates through that function
 * first. `subscriptionCounts` is purely inert data for a future
 * multi-account-credential-storage issue to consume; nothing here changes
 * how any provider adapter or secret is named or stored.
 */
export const warmupSettings = pgTable("warmup_settings", {
  id: serial("id").primaryKey(),
  accountLogin: text("account_login").notNull().unique(),
  scheduleConfig: jsonb("schedule_config").$type<ScheduleConfig>().notNull(),
  subscriptionCounts: jsonb("subscription_counts").$type<Record<string, number>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
