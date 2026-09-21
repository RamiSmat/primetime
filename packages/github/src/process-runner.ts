import spawn from "cross-spawn";

export interface GhRunOptions {
  readonly args: readonly string[];
  /** Written to the child's stdin and closed; used for secret values so they never appear in argv or env. */
  readonly input?: string;
  readonly cwd?: string;
  readonly env: NodeJS.ProcessEnv;
  readonly timeoutMs: number;
  readonly maxOutputBytes: number;
}

export interface GhRunResult {
  readonly exitCode: number | null;
  readonly timedOut: boolean;
  readonly executableMissing: boolean;
  readonly stdout: string;
  readonly stderr: string;
}

export interface GhRunner {
  run(options: GhRunOptions): Promise<GhRunResult>;
}

class BoundedCollector {
  private byteLength = 0;
  private readonly chunks: Buffer[] = [];

  public constructor(private readonly limitBytes: number) {}

  public add(chunk: Buffer): void {
    if (this.byteLength >= this.limitBytes) {
      return;
    }

    const remaining = this.limitBytes - this.byteLength;
    const bounded = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
    this.chunks.push(bounded);
    this.byteLength += bounded.length;
  }

  public toString(): string {
    return Buffer.concat(this.chunks).toString("utf8");
  }
}

/**
 * Runs the `gh` CLI. Any `input` is written directly to the child's stdin
 * stream rather than passed as a CLI argument or environment variable, so a
 * secret value never appears in argv (visible to other users via process
 * listings) or gets echoed by shell tracing.
 */
export class NodeGhRunner implements GhRunner {
  public async run(options: GhRunOptions): Promise<GhRunResult> {
    const stdout = new BoundedCollector(options.maxOutputBytes);
    const stderr = new BoundedCollector(options.maxOutputBytes);

    return new Promise<GhRunResult>((resolve) => {
      let timedOut = false;
      let executableMissing = false;
      let settled = false;

      const child = spawn("gh", [...options.args], {
        cwd: options.cwd,
        env: options.env,
        stdio: ["pipe", "pipe", "pipe"],
      });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, options.timeoutMs);

      child.stdout?.on("data", (chunk: Buffer) => stdout.add(chunk));
      child.stderr?.on("data", (chunk: Buffer) => stderr.add(chunk));

      const settle = (exitCode: number | null): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve({
          exitCode,
          timedOut,
          executableMissing,
          stdout: stdout.toString(),
          stderr: stderr.toString(),
        });
      };

      child.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") {
          executableMissing = true;
        }
        settle(null);
      });

      child.on("close", (code) => {
        settle(code);
      });

      if (options.input !== undefined) {
        child.stdin?.end(options.input, "utf8");
      } else {
        child.stdin?.end();
      }
    });
  }
}

export const defaultGhRunner: GhRunner = new NodeGhRunner();
