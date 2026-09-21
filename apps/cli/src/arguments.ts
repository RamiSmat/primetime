import { PrimeTimeError } from "@primetime/shared";

export const CLI_USAGE = "Usage: primetime prime <provider>";

export interface PrimeCommand {
  readonly command: "prime";
  readonly provider: string;
}

export class CliUsageError extends PrimeTimeError {
  public constructor() {
    super("invalid_configuration", CLI_USAGE);
    this.name = "CliUsageError";
  }
}

export function parseCliArguments(args: readonly string[]): PrimeCommand {
  const [command, provider, ...extraArguments] = args;

  if (
    command !== "prime" ||
    provider === undefined ||
    provider.trim() === "" ||
    extraArguments.length > 0
  ) {
    throw new CliUsageError();
  }

  return { command, provider };
}
