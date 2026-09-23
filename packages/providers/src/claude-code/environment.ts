const API_BILLING_ENV_VARS = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"] as const;

/**
 * Strips API-billing environment variables from a child process environment
 * so that a key or bearer token present in the parent shell can never be
 * picked up implicitly by the Claude Code CLI and used to bill an API key
 * instead of consuming the intended subscription usage window — both rank
 * above `CLAUDE_CODE_OAUTH_TOKEN` in Claude Code's credential precedence,
 * and in non-interactive (`-p`) mode an API key is always used when
 * present, with no approval prompt to decline it.
 */
export function withoutApiBillingEnv(
  env: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const sanitized: NodeJS.ProcessEnv = { ...env };

  for (const key of API_BILLING_ENV_VARS) {
    delete sanitized[key];
  }

  return sanitized;
}
