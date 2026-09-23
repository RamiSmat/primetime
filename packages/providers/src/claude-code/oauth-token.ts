import { PrimeTimeError } from "@primetime/shared";

export class ClaudeCodeOAuthTokenMissingError extends PrimeTimeError {
  public constructor() {
    super(
      "authentication_expired",
      "No token was provided on stdin. Run `claude setup-token` locally, then pipe the printed token into this command.",
    );
    this.name = "ClaudeCodeOAuthTokenMissingError";
  }
}

/**
 * Drains real stdin. Structurally identical to `apps/cli/src/bin.ts`'s own
 * `readStdin` — duplicated here rather than imported because
 * `@primetime/providers` cannot depend on `apps/cli` (the dependency runs
 * the other way).
 */
export async function readProcessStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Reads the CI OAuth token PrimeTime is asked to transfer to a GitHub
 * Actions secret. Unlike Codex's local `auth.json`, `claude setup-token`
 * never writes this token to disk — it only prints it to the terminal — so
 * there is nothing on the local filesystem to read; the caller must supply
 * it. This value is password-equivalent — the caller must never log it,
 * echo it, or include it in an error message.
 */
export async function readOauthToken(
  readInput: () => Promise<string>,
): Promise<string> {
  const token = (await readInput()).trim();

  if (token === "") {
    throw new ClaudeCodeOAuthTokenMissingError();
  }

  return token;
}
