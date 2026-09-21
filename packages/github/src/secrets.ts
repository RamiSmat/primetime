import { PrimeTimeError } from "@primetime/shared";

import { defaultGhRunner, type GhRunner } from "./process-runner.js";
import { GhCliUnavailableError, type RepositoryRef } from "./repository.js";

export class SecretWriteFailedError extends PrimeTimeError {
  public constructor() {
    super(
      "unknown_failure",
      "Could not write the GitHub Actions secret. Ensure `gh auth status` succeeds and that you have permission to manage this repository's secrets.",
    );
    this.name = "SecretWriteFailedError";
  }
}

const SECRET_WRITE_TIMEOUT_MS = 15_000;
const MAX_OUTPUT_BYTES = 64 * 1024;

export interface SetRepositorySecretOptions {
  readonly name: string;
  readonly value: string;
  readonly repository: RepositoryRef;
}

/**
 * Sets a GitHub Actions repository secret via `gh secret set`. `gh`
 * encrypts the value locally (GitHub's API requires a libsodium sealed-box
 * payload) before it ever leaves this machine, so no custom cryptography
 * is implemented here. The value is piped over stdin, never passed as a
 * CLI argument, so it cannot appear in process listings.
 */
export async function setRepositorySecret(
  options: SetRepositorySecretOptions,
  runner: GhRunner = defaultGhRunner,
): Promise<void> {
  const result = await runner.run({
    args: [
      "secret",
      "set",
      options.name,
      "--repo",
      `${options.repository.owner}/${options.repository.name}`,
    ],
    input: options.value,
    env: process.env,
    timeoutMs: SECRET_WRITE_TIMEOUT_MS,
    maxOutputBytes: MAX_OUTPUT_BYTES,
  });

  if (result.executableMissing) {
    throw new GhCliUnavailableError();
  }

  if (result.timedOut || result.exitCode !== 0) {
    throw new SecretWriteFailedError();
  }
}
