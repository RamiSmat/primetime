import { integer, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

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
