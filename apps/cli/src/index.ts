import { selectProvider } from "@primetime/providers";
import { PrimeTimeError } from "@primetime/shared";

import { parseCliArguments } from "./arguments.js";

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
    const provider = selectProvider(command.provider);
    const result = await provider.prime();

    if (!result.success) {
      io.writeError(result.message);
      return 1;
    }

    io.writeOutput(result.message);
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
