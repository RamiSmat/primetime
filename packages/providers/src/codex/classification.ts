import type { PrimeErrorCategory } from "../adapter.js";

export type CodexAuthCategory =
  | "chatgpt"
  | "access_token"
  | "workload_identity"
  | "other_non_api"
  | "api_key"
  | "not_logged_in"
  | "unknown";

const API_KEY_PATTERN = /api[ _-]?key/i;
const NOT_LOGGED_IN_PATTERN = /not logged in/i;
const CHATGPT_PATTERN = /chatgpt/i;
const ACCESS_TOKEN_PATTERN = /access token/i;
const WORKLOAD_IDENTITY_PATTERN = /workload identity/i;
const LOGGED_IN_PATTERN = /logged in/i;

/**
 * Classifies `codex login status` output into a login category. The
 * installed CLI (0.155.1) writes its status line to stderr, not stdout, so
 * callers must pass the combined stdout+stderr text — this was confirmed by
 * running the real command, not assumed from `--help`. An API-key login is
 * rejected explicitly (it consumes API billing, not a subscription usage
 * window). Anything that cannot be positively identified as a known
 * non-API login is classified as "unknown" and treated as not authenticated
 * by {@link isAcceptedNonApiAuth} — unrecognized output must never be
 * treated as a pass.
 */
export function classifyLoginStatus(
  exitCode: number | null,
  output: string,
): CodexAuthCategory {
  if (API_KEY_PATTERN.test(output)) {
    return "api_key";
  }

  if (exitCode !== 0 || NOT_LOGGED_IN_PATTERN.test(output)) {
    return "not_logged_in";
  }

  if (CHATGPT_PATTERN.test(output)) {
    return "chatgpt";
  }

  if (ACCESS_TOKEN_PATTERN.test(output)) {
    return "access_token";
  }

  if (WORKLOAD_IDENTITY_PATTERN.test(output)) {
    return "workload_identity";
  }

  if (LOGGED_IN_PATTERN.test(output)) {
    return "other_non_api";
  }

  return "unknown";
}

export function isAcceptedNonApiAuth(category: CodexAuthCategory): boolean {
  return (
    category === "chatgpt" ||
    category === "access_token" ||
    category === "workload_identity" ||
    category === "other_non_api"
  );
}

export interface CodexExecOutcome {
  readonly exitCode: number | null;
  readonly timedOut: boolean;
  readonly executableMissing: boolean;
  /** Combined stdout+stderr text, bounded and never surfaced to the caller. */
  readonly output: string;
}

const RATE_LIMIT_PATTERN = /rate limit|usage limit|quota exceeded|too many requests|\b429\b/i;
const AUTH_FAILURE_PATTERN = /not authenticated|unauthorized|\b401\b|log ?in required|please log in/i;

/**
 * Classifies a failed `codex exec` invocation. Order matters: executable
 * absence and timeouts are unambiguous signals from the runner itself, so
 * they take priority over pattern-matching the (bounded, never-exposed)
 * output sample for authentication or rate-limit wording.
 */
export function classifyExecFailure(
  outcome: CodexExecOutcome,
): PrimeErrorCategory {
  if (outcome.executableMissing) {
    return "cli_unavailable";
  }

  if (outcome.timedOut) {
    return "timeout";
  }

  if (AUTH_FAILURE_PATTERN.test(outcome.output)) {
    return "authentication_required";
  }

  if (RATE_LIMIT_PATTERN.test(outcome.output)) {
    return "rate_limited";
  }

  return "unknown_failure";
}
