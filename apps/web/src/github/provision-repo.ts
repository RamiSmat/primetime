import type { InstallationStore } from "../db/store";

export const WARMUP_REPO_NAME = "primetime-warmup";

export class RepositorySelectionNotAllError extends Error {
  public constructor(public readonly installationId: number) {
    super(
      "The GitHub App installation only covers selected repositories; it must cover all " +
        "repositories so PrimeTime can create and use a new one.",
    );
    this.name = "RepositorySelectionNotAllError";
  }
}

interface CreatedRepository {
  readonly fullName: string;
}

/**
 * Creates (or, if it already exists, reuses) a single dedicated private
 * repository for this user — the "private PrimeTime repo" the project's
 * architecture is built around — and records it as connected. Requires the
 * user's own GitHub App user access token (never persisted beyond this
 * request) and only works when the installation covers "all repositories",
 * since GitHub's "add a repository to an installation" endpoint is
 * restricted to classic PATs and PrimeTime deliberately never asks users
 * for one.
 */
export async function provisionWarmupRepo(options: {
  readonly accessToken: string;
  readonly installation: { readonly installationId: number; readonly repositorySelection: "all" | "selected" };
  readonly store: InstallationStore;
}): Promise<CreatedRepository> {
  if (options.installation.repositorySelection !== "all") {
    throw new RepositorySelectionNotAllError(options.installation.installationId);
  }

  const fullName = await createOrReuseRepository(options.accessToken);
  await options.store.addRepositories(options.installation.installationId, [fullName]);
  return { fullName };
}

async function createOrReuseRepository(accessToken: string): Promise<string> {
  const headers = {
    authorization: `Bearer ${accessToken}`,
    accept: "application/vnd.github+json",
    "content-type": "application/json",
    "user-agent": "primetime-web",
  };

  const createResponse = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: WARMUP_REPO_NAME,
      private: true,
      description: "Created by PrimeTime — holds the scheduled workflow that warms up your AI coding CLI.",
      auto_init: true,
    }),
  });

  if (createResponse.ok) {
    const body = (await createResponse.json()) as { full_name?: unknown };
    if (typeof body.full_name === "string") {
      return body.full_name;
    }
    throw new Error("GitHub did not return the new repository's name.");
  }

  // 422 means a repository with this name already exists for the user —
  // most likely from an earlier attempt. Reuse it instead of failing.
  if (createResponse.status === 422) {
    const existing = await fetch("https://api.github.com/user", { headers });
    if (!existing.ok) {
      throw new Error("Could not resolve the existing warmup repository owner.");
    }
    const user = (await existing.json()) as { login?: unknown };
    if (typeof user.login !== "string") {
      throw new Error("Could not resolve the existing warmup repository owner.");
    }
    return `${user.login}/${WARMUP_REPO_NAME}`;
  }

  throw new Error(`GitHub repository creation failed with status ${createResponse.status}.`);
}
