import { PrimeTimeError } from "@primetime/shared";

export const CLI_USAGE =
  "Usage: primetime prime <provider>\n" +
  "       primetime schedule next <config-path>\n" +
  "       primetime setup <provider>\n" +
  "       primetime setup github-secrets-pat";

export interface PrimeCommand {
  readonly command: "prime";
  readonly provider: string;
}

export interface ScheduleNextCommand {
  readonly command: "schedule-next";
  readonly configPath: string;
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
  | SetupProviderCommand
  | SetupGithubSecretsPatCommand;

export class CliUsageError extends PrimeTimeError {
  public constructor() {
    super("invalid_configuration", CLI_USAGE);
    this.name = "CliUsageError";
  }
}

export function parseCliArguments(args: readonly string[]): CliCommand {
  const [first, second, third, ...extraArguments] = args;

  if (first === "prime") {
    if (second === undefined || second.trim() === "" || third !== undefined || extraArguments.length > 0) {
      throw new CliUsageError();
    }
    return { command: "prime", provider: second };
  }

  if (first === "schedule" && second === "next") {
    if (third === undefined || third.trim() === "" || extraArguments.length > 0) {
      throw new CliUsageError();
    }
    return { command: "schedule-next", configPath: third };
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
