import type { PrimeErrorCategory } from "../adapter.js";

export type ClaudeCodeAuthCategory =
  | "subscription"
  | "oauth_token"
  | "cloud_provider"
  | "api_key"
  | "not_logged_in"
  | "unknown";

interface ClaudeCodeAuthStatusJson {
  readonly loggedIn?: boolean;
  readonly authMethod?: string;
  readonly apiProvider?: string;
  readonly apiKeySource?: string;
}

interface ClaudeCodeResultJson {
  readonly is_error?: boolean;
  readonly api_error_status?: number | null;
  readonly result?: string;
}

function parseJson<T>(text: string): T | undefined {
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

const CLOUD_PROVIDERS = new Set(["bedrock", "vertex", "foundry"]);

/**
 * Classifies `claude auth status` output (default JSON format) into a login
 * category. Verified against the installed CLI (`claude` 2.1.278) by
 * running it live with a real `claude.ai` login, a fake
 * `CLAUDE_CODE_OAUTH_TOKEN`, and a fake `ANTHROPIC_API_KEY` — an API key
 * surfaces as a truthy `apiKeySource` field alongside `loggedIn: true`
 * (non-interactive mode always uses it when present, so it must be
 * rejected exactly like Codex rejects an API-key login). Anything that
 * cannot be positively identified as a known non-API login is classified
 * as "unknown" and treated as not authenticated by
 * {@link isAcceptedNonApiAuth} — unrecognized or unparsable output must
 * never be treated as a pass.
 */
export function classifyAuthStatus(
  exitCode: number | null,
  stdout: string,
): ClaudeCodeAuthCategory {
  const parsed = parseJson<ClaudeCodeAuthStatusJson>(stdout);
  if (parsed === undefined) {
    return "unknown";
  }

  if (parsed.apiKeySource !== undefined && parsed.apiKeySource !== "") {
    return "api_key";
  }

  if (exitCode !== 0 || parsed.loggedIn !== true) {
    return "not_logged_in";
  }

  if (parsed.authMethod === "claude.ai" || parsed.authMethod === "console") {
    return "subscription";
  }

  if (parsed.authMethod === "oauth_token") {
    return "oauth_token";
  }

  if (parsed.apiProvider !== undefined && CLOUD_PROVIDERS.has(parsed.apiProvider)) {
    return "cloud_provider";
  }

  return "unknown";
}

export function isAcceptedNonApiAuth(category: ClaudeCodeAuthCategory): boolean {
  return (
    category === "subscription" ||
    category === "oauth_token" ||
    category === "cloud_provider"
  );
}

export interface ClaudeCodeExecOutcome {
  readonly exitCode: number | null;
  readonly timedOut: boolean;
  readonly executableMissing: boolean;
  /** Raw stdout from a `--output-format json` primer run, bounded and never surfaced to the caller. */
  readonly stdout: string;
}

const RATE_LIMIT_PATTERN = /rate limit|usage limit|quota exceeded|too many requests/i;
const AUTH_FAILURE_PATTERN = /authenticat|unauthorized|invalid bearer token|log ?in required/i;

/**
 * Classifies a failed `claude -p ... --output-format json` invocation.
 * Order matters: executable absence and timeouts are unambiguous signals
 * from the runner itself, so they take priority over parsing the
 * (bounded, never-exposed) JSON result. Verified live with a deliberately
 * invalid `CLAUDE_CODE_OAUTH_TOKEN`, which produced
 * `{"is_error":true,"api_error_status":401,"result":"Failed to
 * authenticate. API Error: 401 Invalid bearer token",...}` on exit code 1.
 */
export function classifyExecFailure(
  outcome: ClaudeCodeExecOutcome,
): PrimeErrorCategory {
  if (outcome.executableMissing) {
    return "cli_unavailable";
  }

  if (outcome.timedOut) {
    return "timeout";
  }

  const parsed = parseJson<ClaudeCodeResultJson>(outcome.stdout);
  if (parsed === undefined) {
    return "unknown_failure";
  }

  const resultText = parsed.result ?? "";

  if (parsed.api_error_status === 401 || AUTH_FAILURE_PATTERN.test(resultText)) {
    return "authentication_required";
  }

  if (parsed.api_error_status === 429 || RATE_LIMIT_PATTERN.test(resultText)) {
    return "rate_limited";
  }

  return "unknown_failure";
}
