import { readFile } from "node:fs/promises";

import { parseScheduleConfig, type ScheduleConfig } from "@primetime/scheduler";
import { PrimeTimeError } from "@primetime/shared";

export class ScheduleConfigFileError extends PrimeTimeError {
  public constructor(configPath: string, reason: string) {
    super(
      "invalid_configuration",
      `Could not read schedule configuration from "${configPath}": ${reason}`,
    );
    this.name = "ScheduleConfigFileError";
  }
}

export async function readScheduleConfigFile(configPath: string): Promise<ScheduleConfig> {
  let fileContents: string;
  try {
    fileContents = await readFile(configPath, "utf8");
  } catch {
    throw new ScheduleConfigFileError(configPath, "the file could not be read.");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(fileContents);
  } catch {
    throw new ScheduleConfigFileError(configPath, "the file is not valid JSON.");
  }

  return parseScheduleConfig(parsedJson);
}
