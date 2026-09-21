import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { PrimeTimeError } from "@primetime/shared";

export class CodexAuthFileUnavailableError extends PrimeTimeError {
  public constructor() {
    super(
      "authentication_expired",
      "Could not read the local Codex auth file. Run `codex login` locally first.",
    );
    this.name = "CodexAuthFileUnavailableError";
  }
}

function resolveCodexHome(env: NodeJS.ProcessEnv): string {
  const configured = env.CODEX_HOME;
  return configured !== undefined && configured.trim() !== "" ? configured : join(homedir(), ".codex");
}

/**
 * Reads the local Codex CLI's session file (`$CODEX_HOME/auth.json`) so it
 * can be transferred directly to a GitHub Actions secret. This file is
 * password-equivalent — the caller must never log it, echo it, or include
 * it in an error message.
 */
export async function readLocalCodexAuthFile(
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const authFilePath = join(resolveCodexHome(env), "auth.json");

  try {
    return await readFile(authFilePath, "utf8");
  } catch {
    throw new CodexAuthFileUnavailableError();
  }
}
