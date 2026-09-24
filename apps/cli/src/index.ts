import { selectProvider } from "@primetime/providers";
import { computeNextPrimerRun, isPrimerDue } from "@primetime/scheduler";
import { PrimeTimeError } from "@primetime/shared";

import { parseCliArguments } from "./arguments.js";
import { setupGithubSecretsPat } from "./github-secrets-pat.js";
import { readScheduleConfigFile } from "./schedule.js";

/** Exit code for `schedule due` when no primer is due right now — an expected outcome, not a failure. */
export const SCHEDULE_NOT_DUE_EXIT_CODE = 2;

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

    if (command.command === "schedule-due") {
      const config = await readScheduleConfigFile(command.configPath);
      const due = isPrimerDue(config, new Date(), command.toleranceMinutes, command.lastPrimedAt);

      if (due) {
        io.writeOutput(`Primer is due (tolerance ${command.toleranceMinutes}m).`);
        return 0;
      }

      io.writeOutput(`Primer is not due (tolerance ${command.toleranceMinutes}m).`);
      return SCHEDULE_NOT_DUE_EXIT_CODE;
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
