#!/usr/bin/env node

import { runCli } from "./index.js";

process.exitCode = await runCli(process.argv.slice(2), {
  writeOutput: (message: string): void => console.log(message),
  writeError: (message: string): void => console.error(message),
});
