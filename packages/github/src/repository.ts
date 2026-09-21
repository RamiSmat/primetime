import { PrimeTimeError } from "@primetime/shared";

import { defaultGhRunner, type GhRunner } from "./process-runner.js";

export interface RepositoryRef {
  readonly owner: string;
  readonly name: string;
}

export class GhCliUnavailableError extends PrimeTimeError {
  public constructor() {
    super(
      "cli_unavailable",
      "The GitHub CLI (gh) was not found. Install it and run `gh auth login` first.",
    );
    this.name = "GhCliUnavailableError";
  }
}

export class RepositoryNotResolvedError extends PrimeTimeError {
  public constructor() {
    super(
      "invalid_configuration",
      "Could not determine the target GitHub repository. Run this from inside a git checkout with a GitHub remote, and make sure `gh auth status` succeeds.",
    );
    this.name = "RepositoryNotResolvedError";
  }
}

const REPOSITORY_TIMEOUT_MS = 15_000;
const MAX_OUTPUT_BYTES = 64 * 1024;

interface RepoViewJson {
  readonly nameWithOwner?: unknown;
}

function isRepoViewJson(value: unknown): value is RepoViewJson {
  return typeof value === "object" && value !== null;
}

/**
 * Resolves the current directory's GitHub repository via `gh repo view`,
 * rather than parsing `git remote` output ourselves — this way `gh`'s own
 * authentication and remote-detection rules are the single source of truth.
 */
export async function resolveRepository(
  runner: GhRunner = defaultGhRunner,
  cwd?: string,
): Promise<RepositoryRef> {
  const result = await runner.run({
    args: ["repo", "view", "--json", "nameWithOwner"],
    ...(cwd === undefined ? {} : { cwd }),
    env: process.env,
    timeoutMs: REPOSITORY_TIMEOUT_MS,
    maxOutputBytes: MAX_OUTPUT_BYTES,
  });

  if (result.executableMissing) {
    throw new GhCliUnavailableError();
  }

  if (result.timedOut || result.exitCode !== 0) {
    throw new RepositoryNotResolvedError();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new RepositoryNotResolvedError();
  }

  if (!isRepoViewJson(parsed) || typeof parsed.nameWithOwner !== "string") {
    throw new RepositoryNotResolvedError();
  }

  const [owner, name] = parsed.nameWithOwner.split("/");
  if (owner === undefined || name === undefined || owner === "" || name === "") {
    throw new RepositoryNotResolvedError();
  }

  return { owner, name };
}
