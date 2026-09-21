import spawn from "cross-spawn";

export interface SubprocessRunOptions {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly env: NodeJS.ProcessEnv;
  readonly timeoutMs: number;
  readonly maxOutputBytes: number;
}

export interface SubprocessResult {
  readonly exitCode: number | null;
  readonly timedOut: boolean;
  readonly executableMissing: boolean;
  readonly stdout: string;
  readonly stderr: string;
}

export interface SubprocessRunner {
  run(options: SubprocessRunOptions): Promise<SubprocessResult>;
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
 * Uses `cross-spawn` instead of a bare `child_process.spawn`: on Windows,
 * `spawn`'s own PATH lookup does not resolve `.cmd`/`.bat` shims (how most
 * globally installed Node CLIs, including Codex, are exposed on PATH)
 * without `shell: true` — and `shell: true` only concatenates array
 * arguments rather than escaping them, which corrupts any argument
 * containing spaces (our primer prompt is a multi-word string) and is
 * flagged by Node itself as a security risk (DEP0190). `cross-spawn`
 * resolves the executable and quotes arguments correctly without a shell.
 */
export class NodeSubprocessRunner implements SubprocessRunner {
  public async run(options: SubprocessRunOptions): Promise<SubprocessResult> {
    const stdout = new BoundedCollector(options.maxOutputBytes);
    const stderr = new BoundedCollector(options.maxOutputBytes);

    return new Promise<SubprocessResult>((resolve) => {
      let timedOut = false;
      let executableMissing = false;
      let settled = false;

      const child = spawn(options.command, [...options.args], {
        cwd: options.cwd,
        env: options.env,
        stdio: ["ignore", "pipe", "pipe"],
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
    });
  }
}

export const defaultSubprocessRunner: SubprocessRunner = new NodeSubprocessRunner();
