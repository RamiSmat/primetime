export const CODEX_PRIMER_PROMPT =
  "Reply only with OK. Do not use tools or inspect files.";

export function buildVersionArgs(): readonly string[] {
  return ["--version"];
}

export function buildLoginStatusArgs(): readonly string[] {
  return ["login", "status"];
}

/**
 * Flags verified against the installed CLI's own `--help` output before
 * this was written (see the Codex provider README section). `--search`
 * (live web search) is a top-level flag that `codex exec --help` does not
 * even expose, so simply omitting it keeps web search off for `exec`.
 */
export function buildPrimerArgs(workingDirectory: string): readonly string[] {
  return [
    "exec",
    "--ephemeral",
    "--ignore-user-config",
    "--ignore-rules",
    "--sandbox",
    "read-only",
    "--skip-git-repo-check",
    "--color",
    "never",
    "-c",
    "shell_environment_policy.inherit=none",
    "-C",
    workingDirectory,
    CODEX_PRIMER_PROMPT,
  ];
}
