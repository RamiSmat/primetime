import type {
  SubprocessResult,
  SubprocessRunner,
  SubprocessRunOptions,
} from "../../src/codex/process-runner.js";

export type FakeSubprocessResponder = (
  options: SubprocessRunOptions,
) => SubprocessResult | Promise<SubprocessResult>;

export class FakeSubprocessRunner implements SubprocessRunner {
  public readonly calls: SubprocessRunOptions[] = [];

  public constructor(private readonly respond: FakeSubprocessResponder) {}

  public async run(options: SubprocessRunOptions): Promise<SubprocessResult> {
    this.calls.push(options);
    return this.respond(options);
  }
}

export function subprocessResult(
  overrides: Partial<SubprocessResult> = {},
): SubprocessResult {
  return {
    exitCode: 0,
    timedOut: false,
    executableMissing: false,
    stdout: "",
    stderr: "",
    ...overrides,
  };
}
