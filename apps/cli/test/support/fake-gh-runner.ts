import type { GhRunOptions, GhRunner, GhRunResult } from "@primetime/github";

export type FakeGhResponder = (options: GhRunOptions) => GhRunResult | Promise<GhRunResult>;

export class FakeGhRunner implements GhRunner {
  public readonly calls: GhRunOptions[] = [];

  public constructor(private readonly respond: FakeGhResponder) {}

  public async run(options: GhRunOptions): Promise<GhRunResult> {
    this.calls.push(options);
    return this.respond(options);
  }
}

export function ghRunResult(overrides: Partial<GhRunResult> = {}): GhRunResult {
  return {
    exitCode: 0,
    timedOut: false,
    executableMissing: false,
    stdout: "",
    stderr: "",
    ...overrides,
  };
}
