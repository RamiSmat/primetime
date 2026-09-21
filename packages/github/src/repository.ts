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

function parseOwnerRepo(nameWithOwner: string): RepositoryRef | undefined {
  const [owner, name] = nameWithOwner.split("/");
  if (owner === undefined || name === undefined || owner === "" || name === "") {
    return undefined;
  }
  return { owner, name };
}

/**
 * Resolves the target GitHub repository. If `GH_REPO` is set (the same
 * environment variable `gh` itself documents for "commands that otherwise
 * operate on a local repository"), it's used directly — `gh repo view`
 * does NOT actually honor `GH_REPO` itself (verified: it still shells out
 * to `git` and fails outside a git checkout even with `GH_REPO` set), which
 * matters for a GitHub Actions runner that has no git checkout of the repo
 * the workflow lives in. Otherwise falls back to `gh repo view`, so `gh`'s
 * own authentication and remote-detection rules are the source of truth in
 * an ordinary local checkout.
 */
export async function resolveRepository(
  runner: GhRunner = defaultGhRunner,
  cwd?: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<RepositoryRef> {
  const override = env.GH_REPO;
  if (override !== undefined && override.trim() !== "") {
    const parsed = parseOwnerRepo(override.trim());
    if (parsed === undefined) {
      throw new RepositoryNotResolvedError();
    }
    return parsed;
  }

  const result = await runner.run({
    args: ["repo", "view", "--json", "nameWithOwner"],
    ...(cwd === undefined ? {} : { cwd }),
    env,
    timeoutMs: REPOSITORY_TIMEOUT_MS,
    maxOutputBytes: MAX_OUTPUT_BYTES,
  });

  if (result.executableMissing) {
    throw new GhCliUnavailableError();
  }

  if (result.timedOut || result.exitCode !== 0) {
    throw new RepositoryNotResolvedError();
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(result.stdout);
  } catch {
    throw new RepositoryNotResolvedError();
  }

  if (!isRepoViewJson(parsedJson) || typeof parsedJson.nameWithOwner !== "string") {
    throw new RepositoryNotResolvedError();
  }

  const repository = parseOwnerRepo(parsedJson.nameWithOwner);
  if (repository === undefined) {
    throw new RepositoryNotResolvedError();
  }

  return repository;
}
