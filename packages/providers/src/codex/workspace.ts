import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Runs `run` with a freshly created, empty temporary directory as its
 * working directory, and always removes that directory afterward — the
 * primer request must never execute inside this repository or any other
 * user directory.
 */
export async function withEphemeralWorkspace<T>(
  run: (workingDirectory: string) => Promise<T>,
): Promise<T> {
  const workingDirectory = await mkdtemp(join(tmpdir(), "primetime-codex-"));

  try {
    return await run(workingDirectory);
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}
