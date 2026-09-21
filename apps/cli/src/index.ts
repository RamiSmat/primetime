import { selectProvider } from "@primetime/providers";
import { computeNextPrimerRun } from "@primetime/scheduler";
import { PrimeTimeError } from "@primetime/shared";

import { parseCliArguments } from "./arguments.js";
import { setupGithubSecretsPat } from "./github-secrets-pat.js";
import { readScheduleConfigFile } from "./schedule.js";

export interface CliIo {
  writeOutput(message: string): void;
  writeError(message: string): void;
  /** Reads the process's full stdin as text; used for secret values so they never appear in argv. */
  readInput(): Promise<string>;
}

export async function runCli(
  args: readonly string[],
  io: CliIo,
): Promise<number> {
  try {
    const command = parseCliArguments(args);

    if (command.command === "prime") {
      const provider = selectProvider(command.provider);
      const result = await provider.prime();

      if (!result.success) {
        io.writeError(result.message);
        return 1;
      }

      io.writeOutput(result.message);
      return 0;
    }

    if (command.command === "schedule-next") {
      const config = await readScheduleConfigFile(command.configPath);
      const nextRun = computeNextPrimerRun(config, new Date());
      io.writeOutput(`Next primer run: ${nextRun.toISOString()}`);
      return 0;
    }

    if (command.command === "setup-provider") {
      const provider = selectProvider(command.provider);
      const result = await provider.setup();

      if (!result.configured) {
        io.writeError(result.message);
        return 1;
      }

      io.writeOutput(result.message);
      return 0;
    }

    const patValue = (await io.readInput()).trim();
    if (patValue === "") {
      io.writeError("No PAT value was provided on stdin.");
      return 1;
    }

    const message = await setupGithubSecretsPat(patValue);
    io.writeOutput(message);
    return 0;
  } catch (error: unknown) {
    if (error instanceof PrimeTimeError) {
      io.writeError(error.message);
    } else {
      io.writeError("PrimeTime failed with an unknown error.");
    }

    return 1;
  }
}

export { CliUsageError, parseCliArguments } from "./arguments.js";
export { selectProvider } from "@primetime/providers";
export { ScheduleConfigFileError, readScheduleConfigFile } from "./schedule.js";
export { PRIMETIME_SECRETS_PAT_NAME, setupGithubSecretsPat } from "./github-secrets-pat.js";
