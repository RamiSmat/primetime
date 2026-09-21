import type { PrimeErrorCategory } from "../adapter.js";

import type { CodexAuthCategory } from "./classification.js";

/**
 * Every user-facing message here is a fixed literal string. None of them
 * may ever be built by interpolating captured stdout/stderr, environment
 * values, or file paths — that is how credentials or account-identifying
 * details could leak into logs or terminal output.
 */
export const CODEX_SUCCESS_MESSAGE = "Codex primer completed successfully.";

export const CODEX_FAILURE_MESSAGES: Record<PrimeErrorCategory, string> = {
  cli_unavailable:
    "Codex CLI was not found. Install the official Codex CLI and ensure it is on PATH.",
  authentication_required:
    "Codex is not authenticated with a supported non-API login. Run `codex login` and try again.",
  timeout: "The Codex primer request timed out before completing.",
  rate_limited: "Codex reported a rate or usage limit. Try again later.",
  unknown_failure: "The Codex primer request failed for an unspecified reason.",
};

const API_KEY_AUTH_MESSAGE =
  "Codex is currently authenticated with an API key, which bills per-request and is not a subscription usage window. Run `codex login` with ChatGPT or another supported non-API method.";

export function authFailureMessage(category: CodexAuthCategory): string {
  return category === "api_key" ? API_KEY_AUTH_MESSAGE : CODEX_FAILURE_MESSAGES.authentication_required;
}
