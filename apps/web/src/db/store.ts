import { neon } from "@neondatabase/serverless";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import { githubInstallations, installationRepositories } from "./schema";

export interface InstallationRecord {
  readonly installationId: number;
  readonly accountLogin: string;
}

/**
 * Tracks which GitHub App installation covers which repositories, kept in
 * sync from webhook events. This is the only lookup the Actions
 * token-exchange endpoint trusts to decide which repository an installation
 * token may be scoped to.
 */
export interface InstallationStore {
  upsertInstallation(installation: InstallationRecord): Promise<void>;
  removeInstallation(installationId: number): Promise<void>;
  setRepositories(installationId: number, repositoryFullNames: readonly string[]): Promise<void>;
  addRepositories(installationId: number, repositoryFullNames: readonly string[]): Promise<void>;
  removeRepositories(
    installationId: number,
    repositoryFullNames: readonly string[],
  ): Promise<void>;
  findInstallationForRepository(
    repositoryFullName: string,
  ): Promise<InstallationRecord | undefined>;
  listRepositoriesForAccount(accountLogin: string): Promise<readonly string[]>;
}

/** Drizzle-backed implementation for production, over Neon's serverless HTTP driver. */
export class DrizzleInstallationStore implements InstallationStore {
  private readonly db: ReturnType<typeof drizzle>;

  public constructor(databaseUrl: string) {
    this.db = drizzle(neon(databaseUrl));
  }

  public async upsertInstallation(installation: InstallationRecord): Promise<void> {
    await this.db
      .insert(githubInstallations)
      .values({
        installationId: installation.installationId,
        accountLogin: installation.accountLogin,
      })
      .onConflictDoUpdate({
        target: githubInstallations.installationId,
        set: { accountLogin: installation.accountLogin, updatedAt: new Date() },
      });
  }

  public async removeInstallation(installationId: number): Promise<void> {
    await this.db
      .delete(installationRepositories)
      .where(eq(installationRepositories.installationId, installationId));
    await this.db
      .delete(githubInstallations)
      .where(eq(githubInstallations.installationId, installationId));
  }

  public async setRepositories(
    installationId: number,
    repositoryFullNames: readonly string[],
  ): Promise<void> {
    await this.db
      .delete(installationRepositories)
      .where(eq(installationRepositories.installationId, installationId));
    await this.addRepositories(installationId, repositoryFullNames);
  }

  public async addRepositories(
    installationId: number,
    repositoryFullNames: readonly string[],
  ): Promise<void> {
    if (repositoryFullNames.length === 0) {
      return;
    }
    await this.db
      .insert(installationRepositories)
      .values(
        repositoryFullNames.map((repositoryFullName) => ({
          installationId,
          repositoryFullName,
        })),
      )
      .onConflictDoNothing();
  }

  public async removeRepositories(
    installationId: number,
    repositoryFullNames: readonly string[],
  ): Promise<void> {
    if (repositoryFullNames.length === 0) {
      return;
    }
    await this.db
      .delete(installationRepositories)
      .where(
        and(
          eq(installationRepositories.installationId, installationId),
          inArray(installationRepositories.repositoryFullName, [...repositoryFullNames]),
        ),
      );
  }

  public async findInstallationForRepository(
    repositoryFullName: string,
  ): Promise<InstallationRecord | undefined> {
    const rows = await this.db
      .select({
        installationId: githubInstallations.installationId,
        accountLogin: githubInstallations.accountLogin,
      })
      .from(installationRepositories)
      .innerJoin(
        githubInstallations,
        eq(installationRepositories.installationId, githubInstallations.installationId),
      )
      .where(eq(installationRepositories.repositoryFullName, repositoryFullName))
      .limit(1);

    return rows[0];
  }

  public async listRepositoriesForAccount(accountLogin: string): Promise<readonly string[]> {
    const rows = await this.db
      .select({ repositoryFullName: installationRepositories.repositoryFullName })
      .from(installationRepositories)
      .innerJoin(
        githubInstallations,
        eq(installationRepositories.installationId, githubInstallations.installationId),
      )
      .where(eq(githubInstallations.accountLogin, accountLogin));

    return rows.map((row) => row.repositoryFullName);
  }
}

/** Plain in-memory fake for tests — route-handler tests never need a real Postgres connection. */
export class InMemoryInstallationStore implements InstallationStore {
  private readonly installations = new Map<number, InstallationRecord>();
  private readonly repositories = new Map<number, Set<string>>();

  public async upsertInstallation(installation: InstallationRecord): Promise<void> {
    this.installations.set(installation.installationId, installation);
  }

  public async removeInstallation(installationId: number): Promise<void> {
    this.installations.delete(installationId);
    this.repositories.delete(installationId);
  }

  public async setRepositories(
    installationId: number,
    repositoryFullNames: readonly string[],
  ): Promise<void> {
    this.repositories.set(installationId, new Set(repositoryFullNames));
  }

  public async addRepositories(
    installationId: number,
    repositoryFullNames: readonly string[],
  ): Promise<void> {
    const existing = this.repositories.get(installationId) ?? new Set<string>();
    for (const repositoryFullName of repositoryFullNames) {
      existing.add(repositoryFullName);
    }
    this.repositories.set(installationId, existing);
  }

  public async removeRepositories(
    installationId: number,
    repositoryFullNames: readonly string[],
  ): Promise<void> {
    const existing = this.repositories.get(installationId);
    if (!existing) {
      return;
    }
    for (const repositoryFullName of repositoryFullNames) {
      existing.delete(repositoryFullName);
    }
  }

  public async findInstallationForRepository(
    repositoryFullName: string,
  ): Promise<InstallationRecord | undefined> {
    for (const [installationId, repositoryFullNames] of this.repositories) {
      if (repositoryFullNames.has(repositoryFullName)) {
        return this.installations.get(installationId);
      }
    }
    return undefined;
  }

  public async listRepositoriesForAccount(accountLogin: string): Promise<readonly string[]> {
    const repositoryFullNames: string[] = [];
    for (const [installationId, installation] of this.installations) {
      if (installation.accountLogin !== accountLogin) {
        continue;
      }
      const repositories = this.repositories.get(installationId);
      if (repositories) {
        repositoryFullNames.push(...repositories);
      }
    }
    return repositoryFullNames;
  }
}

let singleton: InstallationStore | undefined;

/** Lazily builds the process-wide store from `DATABASE_URL`, so route handlers share one connection. */
export function getInstallationStore(): InstallationStore {
  if (!singleton) {
    const databaseUrl = process.env["DATABASE_URL"];
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not set.");
    }
    singleton = new DrizzleInstallationStore(databaseUrl);
  }
  return singleton;
}
