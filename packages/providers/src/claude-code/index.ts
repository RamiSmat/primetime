import { defaultGhRunner, resolveRepository, setRepositorySecret, type GhRunner } from "@primetime/github";
import { PrimeTimeError } from "@primetime/shared";

import type {
  AuthValidationResult,
  PrimeResult,
  ProviderAdapter,
  ProviderDetectionResult,
  ProviderSetupResult,
} from "../adapter.js";
import {
  defaultSubprocessRunner,
  type SubprocessRunner,
} from "../codex/process-runner.js";

import {
  classifyAuthStatus,
  classifyExecFailure,
  isAcceptedNonApiAuth,
  type ClaudeCodeAuthCategory,
} from "./classification.js";
import {
  buildAuthStatusArgs,
  buildPrimerArgs,
  buildVersionArgs,
} from "./command.js";
import { withoutApiBillingEnv } from "./environment.js";
import {
  authFailureMessage,
  CLAUDE_CODE_FAILURE_MESSAGES,
  CLAUDE_CODE_SETUP_MESSAGES,
  CLAUDE_CODE_SUCCESS_MESSAGE,
} from "./messages.js";
import { readOauthToken, readProcessStdin } from "./oauth-token.js";
import { withEphemeralWorkspace } from "./workspace.js";

const CLAUDE_CODE_OAUTH_TOKEN_SECRET_NAME = "CLAUDE_CODE_OAUTH_TOKEN";

const VERSION_TIMEOUT_MS = 5_000;
const AUTH_STATUS_TIMEOUT_MS = 10_000;
const PRIMER_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_BYTES = 64 * 1024;

export class ClaudeCodeProvider implements ProviderAdapter {
  public readonly id = "claude-code";
  public readonly name = "Claude Code";

  public constructor(
    private readonly runner: SubprocessRunner = defaultSubprocessRunner,
    private readonly ghRunner: GhRunner = defaultGhRunner,
    private readonly readInput: () => Promise<string> = readProcessStdin,
  ) {}

  public async detect(): Promise<ProviderDetectionResult> {
    const result = await this.runner.run({
      command: "claude",
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
   * Transfers a Claude Code CI token to the target GitHub repository's
   * `CLAUDE_CODE_OAUTH_TOKEN` Actions secret, via `gh secret set` (see
   * `@primetime/github`) — the token never passes through anything but
   * this machine and GitHub's own API. Unlike Codex's local `auth.json`,
   * `claude setup-token` never writes this token to disk, so it is read
   * from stdin instead of a file: run `claude setup-token` locally first,
   * then pipe its printed token into this command.
   */
  public async setup(): Promise<ProviderSetupResult> {
    let token: string;
    try {
      token = await readOauthToken(this.readInput);
    } catch {
      return { configured: false, message: CLAUDE_CODE_SETUP_MESSAGES.tokenMissing };
    }

    const authCategory = await this.detectAuthCategory(token);
    if (!isAcceptedNonApiAuth(authCategory)) {
      return { configured: false, message: authFailureMessage(authCategory) };
    }

    let repository;
    try {
      repository = await resolveRepository(this.ghRunner);
    } catch {
      return { configured: false, message: CLAUDE_CODE_SETUP_MESSAGES.repositoryNotResolved };
    }

    try {
      await setRepositorySecret(
        { name: CLAUDE_CODE_OAUTH_TOKEN_SECRET_NAME, value: token, repository },
        this.ghRunner,
      );
    } catch (error: unknown) {
      const message =
        error instanceof PrimeTimeError && error.kind === "cli_unavailable"
          ? CLAUDE_CODE_SETUP_MESSAGES.ghCliUnavailable
          : CLAUDE_CODE_SETUP_MESSAGES.secretWriteFailed;
      return { configured: false, message };
    }

    return { configured: true, message: CLAUDE_CODE_SETUP_MESSAGES.success };
  }

  public async validateAuthentication(): Promise<AuthValidationResult> {
    const category = await this.detectAuthCategory();
    return { authenticated: isAcceptedNonApiAuth(category) };
  }

  public async prime(): Promise<PrimeResult> {
    const startedAt = Date.now();

    const detection = await this.detect();
    if (!detection.available) {
      return this.toResult(false, startedAt, "cli_unavailable", CLAUDE_CODE_FAILURE_MESSAGES.cli_unavailable);
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
        command: "claude",
        args: buildPrimerArgs(),
        cwd: workingDirectory,
        env: withoutApiBillingEnv(process.env),
        timeoutMs: PRIMER_TIMEOUT_MS,
        maxOutputBytes: MAX_OUTPUT_BYTES,
      });

      if (!execResult.executableMissing && !execResult.timedOut && execResult.exitCode === 0) {
        return this.toResult(true, startedAt, null, CLAUDE_CODE_SUCCESS_MESSAGE);
      }

      const errorCategory = classifyExecFailure({
        exitCode: execResult.exitCode,
        timedOut: execResult.timedOut,
        executableMissing: execResult.executableMissing,
        stdout: execResult.stdout,
      });
      return this.toResult(false, startedAt, errorCategory, CLAUDE_CODE_FAILURE_MESSAGES[errorCategory]);
    });
  }

  /**
   * Checks `claude auth status`. When `tokenOverride` is given (from
   * `setup()`, before it is ever written to a secret), that specific token
   * is checked instead of whatever is ambiently configured on this
   * machine, so a mistyped or invalid paste is caught before it reaches
   * the repository's secret.
   */
  private async detectAuthCategory(tokenOverride?: string): Promise<ClaudeCodeAuthCategory> {
    const env = withoutApiBillingEnv(process.env);
    if (tokenOverride !== undefined) {
      env.CLAUDE_CODE_OAUTH_TOKEN = tokenOverride;
    }

    const result = await this.runner.run({
      command: "claude",
      args: buildAuthStatusArgs(),
      env,
      timeoutMs: AUTH_STATUS_TIMEOUT_MS,
      maxOutputBytes: MAX_OUTPUT_BYTES,
    });

    if (result.executableMissing || result.timedOut) {
      return "not_logged_in";
    }

    return classifyAuthStatus(result.exitCode, result.stdout);
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

export const claudeCodeProvider: ProviderAdapter = new ClaudeCodeProvider();
