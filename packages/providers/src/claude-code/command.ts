export const CLAUDE_CODE_PRIMER_PROMPT =
  "Reply only with OK. Do not use tools or inspect files.";

export function buildVersionArgs(): readonly string[] {
  return ["--version"];
}

export function buildAuthStatusArgs(): readonly string[] {
  return ["auth", "status"];
}

/**
 * Flags verified against the installed CLI (`claude` 2.1.278) by running a
 * real primer request end to end before this was written, not assumed from
 * `--help` alone (see the Claude Code provider README section): `-p` runs
 * one non-interactive turn and exits; `--disallowedTools "*"` removes every
 * tool from context so the primer can never edit files, run commands, or
 * reach the network beyond the model call itself; `--permission-mode plan`
 * additionally starts the session in Claude Code's own read-only plan mode;
 * `--permission-prompts none` denies rather than blocks on any permission
 * prompt that could still occur; `--max-turns 1` bounds the request to a
 * single turn; `--output-format json` gives a structured result to classify
 * instead of free-form text; `--no-session-persistence` avoids writing any
 * session state to disk. Unlike Codex's `exec -C <dir>`, `claude` has no
 * working-directory flag — the ephemeral workspace is applied only via the
 * subprocess's own `cwd`, which also keeps any project-level CLAUDE.md out
 * of scope for the primer request.
 */
export function buildPrimerArgs(): readonly string[] {
  return [
    "-p",
    CLAUDE_CODE_PRIMER_PROMPT,
    "--disallowedTools",
    "*",
    "--permission-mode",
    "plan",
    "--permission-prompts",
    "none",
    "--max-turns",
    "1",
    "--output-format",
    "json",
    "--no-session-persistence",
  ];
}
