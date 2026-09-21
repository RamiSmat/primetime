import { selectProvider } from "@primetime/providers";
import { computeNextPrimerRun } from "@primetime/scheduler";
import { PrimeTimeError } from "@primetime/shared";

import { parseCliArguments } from "./arguments.js";
import { readScheduleConfigFile } from "./schedule.js";

export interface CliIo {
  writeOutput(message: string): void;
  writeError(message: string): void;
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
        io.writeError(`${provider.name} primer did not complete successfully.`);
        return 1;
      }

      io.writeOutput(`${provider.name} primer completed successfully.`);
      return 0;
    }

    const config = await readScheduleConfigFile(command.configPath);
    const nextRun = computeNextPrimerRun(config, new Date());
    io.writeOutput(`Next primer run: ${nextRun.toISOString()}`);
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
