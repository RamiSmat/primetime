import type { PrimeErrorCategory } from "../adapter.js";

import type { ClaudeCodeAuthCategory } from "./classification.js";

/**
 * Every user-facing message here is a fixed literal string. None of them
 * may ever be built by interpolating captured stdout/stderr, environment
 * values, or the token itself — that is how credentials or account-
 * identifying details could leak into logs or terminal output.
 */
export const CLAUDE_CODE_SUCCESS_MESSAGE = "Claude Code primer completed successfully.";

export const CLAUDE_CODE_FAILURE_MESSAGES: Record<PrimeErrorCategory, string> = {
  cli_unavailable:
    "Claude Code CLI was not found. Install the official Claude Code CLI and ensure it is on PATH.",
  authentication_required:
    "Claude Code is not authenticated with a supported non-API login. Run `claude auth login` and try again.",
  timeout: "The Claude Code primer request timed out before completing.",
  rate_limited: "Claude Code reported a rate or usage limit. Try again later.",
  unknown_failure: "The Claude Code primer request failed for an unspecified reason.",
};

const API_KEY_AUTH_MESSAGE =
  "Claude Code is currently authenticated with an API key, which bills per-request and is not a subscription usage window. Run `claude auth login` with a Claude subscription instead.";

export function authFailureMessage(category: ClaudeCodeAuthCategory): string {
  return category === "api_key" ? API_KEY_AUTH_MESSAGE : CLAUDE_CODE_FAILURE_MESSAGES.authentication_required;
}

export const CLAUDE_CODE_SETUP_MESSAGES = {
  success:
    "Claude Code CI token transferred to the repository's CLAUDE_CODE_OAUTH_TOKEN GitHub Actions secret.",
  tokenMissing:
    "No token was provided on stdin. Run `claude setup-token` locally, then pipe the printed token into this command.",
  repositoryNotResolved:
    "Could not determine the target GitHub repository. Run this from inside a git checkout with a GitHub remote, and make sure `gh auth status` succeeds.",
  secretWriteFailed:
    "Could not write the GitHub Actions secret. Ensure `gh auth status` succeeds and that you have permission to manage this repository's secrets.",
  ghCliUnavailable: "The GitHub CLI (gh) was not found. Install it and run `gh auth login` first.",
} as const;
