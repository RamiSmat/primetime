import type { InstallationStore } from "../db/store";

export const WARMUP_REPO_NAME = "primetime-warmup";

export class RepositorySelectionNotAllError extends Error {
  public constructor(public readonly installationId: number) {
    super(
      "The GitHub App installation only covers selected repositories; it must cover all " +
        "repositories so PrimeTime can register and use a new one.",
    );
    this.name = "RepositorySelectionNotAllError";
  }
}

interface WarmupRepository {
  readonly fullName: string;
}

/**
 * Registers the user's dedicated warmup repository as connected — the
 * "private PrimeTime repo" the project's architecture is built around.
 *
 * This does *not* create the repository on GitHub: `POST /user/repos`
 * rejects every kind of GitHub App token (user-to-server included) with
 * `403 Resource not accessible by integration`, confirmed against the
 * real deployment — GitHub reserves account-level repo creation for
 * classic PATs and OAuth Apps, which this project deliberately never asks
 * users for. Instead, `scripts/setup-warmup-repo.sh` creates it locally
 * via `gh repo create`, using the user's own full-scope `gh` login. This
 * function only records the deterministic `<login>/primetime-warmup` name
 * in the DB (so the later GitHub Actions OIDC token exchange in
 * `token-handler.ts` recognizes the repository) and requires the
 * installation to cover "all repositories" so that once the script
 * creates it, the App's installation actually does cover it — the same
 * requirement as before, just no longer paired with an API call that
 * can't succeed.
 */
export async function provisionWarmupRepo(options: {
  readonly installation: {
    readonly installationId: number;
    readonly accountLogin: string;
    readonly repositorySelection: "all" | "selected";
  };
  readonly store: InstallationStore;
}): Promise<WarmupRepository> {
  if (options.installation.repositorySelection !== "all") {
    throw new RepositorySelectionNotAllError(options.installation.installationId);
  }

  const fullName = `${options.installation.accountLogin}/${WARMUP_REPO_NAME}`;
  await options.store.addRepositories(options.installation.installationId, [fullName]);
  return { fullName };
}
