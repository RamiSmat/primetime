import { PrimeTimeError } from "@primetime/shared";

export const CLI_USAGE =
  "Usage: primetime prime <provider>\n       primetime schedule next <config-path>";

export interface PrimeCommand {
  readonly command: "prime";
  readonly provider: string;
}

export interface ScheduleNextCommand {
  readonly command: "schedule-next";
  readonly configPath: string;
}

export type CliCommand = PrimeCommand | ScheduleNextCommand;

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

  throw new CliUsageError();
}
