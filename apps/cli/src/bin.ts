#!/usr/bin/env node

import { runCli } from "./index.js";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

process.exitCode = await runCli(process.argv.slice(2), {
  writeOutput: (message: string): void => console.log(message),
  writeError: (message: string): void => console.error(message),
  readInput: readStdin,
});
