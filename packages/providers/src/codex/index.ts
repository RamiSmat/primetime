import { defaultGhRunner, resolveRepository, setRepositorySecret, type GhRunner } from "@primetime/github";
import { PrimeTimeError } from "@primetime/shared";

import type {
  AuthValidationResult,
  PrimeResult,
  ProviderAdapter,
  ProviderDetectionResult,
  ProviderOperation,
  ProviderSetupResult,
} from "../adapter.js";

import { readLocalCodexAuthFile } from "./auth-file.js";
import {
  classifyExecFailure,
  classifyLoginStatus,
  isAcceptedNonApiAuth,
  type CodexAuthCategory,
} from "./classification.js";
import {
  buildLoginStatusArgs,
  buildPrimerArgs,
  buildVersionArgs,
} from "./command.js";
import { withoutApiBillingEnv } from "./environment.js";
import {
  defaultSubprocessRunner,
  type SubprocessRunner,
} from "./process-runner.js";
import {
  authFailureMessage,
  CODEX_FAILURE_MESSAGES,
  CODEX_SETUP_MESSAGES,
  CODEX_SUCCESS_MESSAGE,
} from "./messages.js";
import { withEphemeralWorkspace } from "./workspace.js";

const CODEX_AUTH_SECRET_NAME = "CODEX_AUTH_JSON";

/**
 * ASSUMPTION, verify before merging: OpenAI's ChatGPT-plan usage limits for
 * the Codex CLI reset on a rolling 5-hour window. Check OpenAI's current
 * Codex CLI / ChatGPT plan rate-limit docs before relying on this — limit
 * structures change independently of when this constant was written.
 */
const CODEX_USAGE_WINDOW_MINUTES = 5 * 60;

export class ProviderOperationNotImplementedError extends PrimeTimeError {
  public constructor(providerName: string, operation: ProviderOperation) {
    super(
      "not_implemented",
      `${providerName} provider ${operation} is not implemented yet. No credentials were read or changed.`,
    );
    this.name = "ProviderOperationNotImplementedError";
  }
}

const VERSION_TIMEOUT_MS = 5_000;
const LOGIN_STATUS_TIMEOUT_MS = 10_000;
const PRIMER_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_BYTES = 64 * 1024;

export class CodexProvider implements ProviderAdapter {
  public readonly id = "codex";
  public readonly name = "Codex";
  public readonly usageWindowMinutes = CODEX_USAGE_WINDOW_MINUTES;

  public constructor(
    private readonly runner: SubprocessRunner = defaultSubprocessRunner,
    private readonly ghRunner: GhRunner = defaultGhRunner,
  ) {}

  public async detect(): Promise<ProviderDetectionResult> {
    const result = await this.runner.run({
      command: "codex",
      args: buildVersionArgs(),
      env: withoutApiBillingEnv(process.env),
      timeoutMs: VERSION_TIMEOUT_MS,
      maxOutputBytes: MAX_OUTPUT_BYTES,
    });

    return {
      available: !result.executableMissing && !result.timedOut && result.exitCode === 0,
    };
  }

  /**
   * Transfers the local Codex CLI session directly to the target GitHub
   * repository's `CODEX_AUTH_JSON` Actions secret, via `gh secret set` (see
   * `@primetime/github`) — the auth file's bytes never pass through
   * anything but this machine and GitHub's own API. This does not
   * authenticate Codex itself; run `codex login` locally first.
   */
  public async setup(): Promise<ProviderSetupResult> {
    const authCategory = await this.detectAuthCategory();
    if (!isAcceptedNonApiAuth(authCategory)) {
      return { configured: false, message: authFailureMessage(authCategory) };
    }

    let authFileContents: string;
    try {
      authFileContents = await readLocalCodexAuthFile();
    } catch {
      return { configured: false, message: CODEX_SETUP_MESSAGES.authFileUnavailable };
    }

    let repository;
    try {
      repository = await resolveRepository(this.ghRunner);
    } catch {
      return { configured: false, message: CODEX_SETUP_MESSAGES.repositoryNotResolved };
    }

    try {
      await setRepositorySecret(
        { name: CODEX_AUTH_SECRET_NAME, value: authFileContents, repository },
        this.ghRunner,
      );
    } catch (error: unknown) {
      const message =
        error instanceof PrimeTimeError && error.kind === "cli_unavailable"
          ? CODEX_SETUP_MESSAGES.ghCliUnavailable
          : CODEX_SETUP_MESSAGES.secretWriteFailed;
      return { configured: false, message };
    }

    return { configured: true, message: CODEX_SETUP_MESSAGES.success };
  }

  public async validateAuthentication(): Promise<AuthValidationResult> {
    const category = await this.detectAuthCategory();
    return { authenticated: isAcceptedNonApiAuth(category) };
  }

  public async prime(): Promise<PrimeResult> {
    const startedAt = Date.now();

    const detection = await this.detect();
    if (!detection.available) {
      return this.toResult(false, startedAt, "cli_unavailable", CODEX_FAILURE_MESSAGES.cli_unavailable);
    }

    const authCategory = await this.detectAuthCategory();
    if (!isAcceptedNonApiAuth(authCategory)) {
      return this.toResult(
        false,
        startedAt,
        "authentication_required",
        authFailureMessage(authCategory),
      );
    }

    return withEphemeralWorkspace(async (workingDirectory) => {
      const execResult = await this.runner.run({
        command: "codex",
        args: buildPrimerArgs(workingDirectory),
        cwd: workingDirectory,
        env: withoutApiBillingEnv(process.env),
        timeoutMs: PRIMER_TIMEOUT_MS,
        maxOutputBytes: MAX_OUTPUT_BYTES,
      });

      if (!execResult.executableMissing && !execResult.timedOut && execResult.exitCode === 0) {
        return this.toResult(true, startedAt, null, CODEX_SUCCESS_MESSAGE);
      }

      const errorCategory = classifyExecFailure({
        ...execResult,
        output: execResult.stdout + execResult.stderr,
      });
      return this.toResult(false, startedAt, errorCategory, CODEX_FAILURE_MESSAGES[errorCategory]);
    });
  }

  private async detectAuthCategory(): Promise<CodexAuthCategory> {
    const result = await this.runner.run({
      command: "codex",
      args: buildLoginStatusArgs(),
      env: withoutApiBillingEnv(process.env),
      timeoutMs: LOGIN_STATUS_TIMEOUT_MS,
      maxOutputBytes: MAX_OUTPUT_BYTES,
    });

    if (result.executableMissing || result.timedOut) {
      return "not_logged_in";
    }

    return classifyLoginStatus(result.exitCode, result.stdout + result.stderr);
  }

  private toResult(
    success: boolean,
    startedAt: number,
    errorCategory: PrimeResult["errorCategory"],
    message: string,
  ): PrimeResult {
    return {
      success,
      provider: this.id,
      durationMs: Date.now() - startedAt,
      errorCategory,
      message,
    };
  }
}

export const codexProvider: ProviderAdapter = new CodexProvider();
