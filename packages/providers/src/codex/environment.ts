const API_BILLING_ENV_VARS = ["OPENAI_API_KEY", "CODEX_API_KEY"] as const;

/**
 * Strips API-key environment variables from a child process environment so
 * that an API key present in the parent shell can never be picked up
 * implicitly by the Codex CLI and used to bill an API key instead of
 * consuming the intended subscription usage window.
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
