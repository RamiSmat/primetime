import { DEFAULT_DUE_TOLERANCE_MINUTES } from "@primetime/scheduler";
import { PrimeTimeError } from "@primetime/shared";

export const CLI_USAGE =
  "Usage: primetime prime <provider>\n" +
  "       primetime schedule next <config-path> <provider>\n" +
  "       primetime schedule due <config-path> <provider> [--tolerance-minutes <n>] [--last-primed-at <iso-timestamp>]\n" +
  "       primetime setup <provider>\n" +
  "       primetime setup github-secrets-pat";

export interface PrimeCommand {
  readonly command: "prime";
  readonly provider: string;
}

export interface ScheduleNextCommand {
  readonly command: "schedule-next";
  readonly configPath: string;
  readonly provider: string;
}

export interface ScheduleDueCommand {
  readonly command: "schedule-due";
  readonly configPath: string;
  readonly provider: string;
  readonly toleranceMinutes: number;
  readonly lastPrimedAt: Date | undefined;
}

export interface SetupProviderCommand {
  readonly command: "setup-provider";
  readonly provider: string;
}

export interface SetupGithubSecretsPatCommand {
  readonly command: "setup-github-secrets-pat";
}

export type CliCommand =
  | PrimeCommand
  | ScheduleNextCommand
  | ScheduleDueCommand
  | SetupProviderCommand
  | SetupGithubSecretsPatCommand;

export class CliUsageError extends PrimeTimeError {
  public constructor() {
    super("invalid_configuration", CLI_USAGE);
    this.name = "CliUsageError";
  }
}

export function parseCliArguments(args: readonly string[]): CliCommand {
  const [first, second, third, fourth, ...extraArguments] = args;

  if (first === "prime") {
    if (second === undefined || second.trim() === "" || third !== undefined || extraArguments.length > 0) {
      throw new CliUsageError();
    }
    return { command: "prime", provider: second };
  }

  if (first === "schedule" && second === "next") {
    if (
      third === undefined ||
      third.trim() === "" ||
      fourth === undefined ||
      fourth.trim() === "" ||
      extraArguments.length > 0
    ) {
      throw new CliUsageError();
    }
    return { command: "schedule-next", configPath: third, provider: fourth };
  }

  if (first === "schedule" && second === "due") {
    if (third === undefined || third.trim() === "" || fourth === undefined || fourth.trim() === "") {
      throw new CliUsageError();
    }

    let toleranceMinutes = DEFAULT_DUE_TOLERANCE_MINUTES;
    let lastPrimedAt: Date | undefined;
    let sawToleranceFlag = false;
    let sawLastPrimedAtFlag = false;

    for (let index = 0; index < extraArguments.length; index += 2) {
      const flag = extraArguments[index];
      const value = extraArguments[index + 1];
      if (value === undefined || value.trim() === "") {
        throw new CliUsageError();
      }

      if (flag === "--tolerance-minutes" && !sawToleranceFlag) {
        sawToleranceFlag = true;
        toleranceMinutes = Number(value);
        if (!Number.isInteger(toleranceMinutes) || toleranceMinutes <= 0) {
          throw new CliUsageError();
        }
        continue;
      }

      if (flag === "--last-primed-at" && !sawLastPrimedAtFlag) {
        sawLastPrimedAtFlag = true;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
          throw new CliUsageError();
        }
        lastPrimedAt = parsed;
        continue;
      }

      throw new CliUsageError();
    }

    return { command: "schedule-due", configPath: third, provider: fourth, toleranceMinutes, lastPrimedAt };
  }

  if (first === "setup") {
    if (second === "github-secrets-pat") {
      if (third !== undefined || extraArguments.length > 0) {
        throw new CliUsageError();
      }
      return { command: "setup-github-secrets-pat" };
    }

    if (second === undefined || second.trim() === "" || third !== undefined || extraArguments.length > 0) {
      throw new CliUsageError();
    }
    return { command: "setup-provider", provider: second };
  }

  throw new CliUsageError();
}
