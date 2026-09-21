import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { CodexProvider } from "../src/codex/index.js";
import { CODEX_SETUP_MESSAGES } from "../src/codex/messages.js";

import { FakeGhRunner, ghRunResult } from "./support/fake-gh-runner.js";
import {
  FakeSubprocessRunner,
  subprocessResult,
} from "./support/fake-subprocess-runner.js";
import type { SubprocessRunOptions } from "../src/codex/process-runner.js";

const SENSITIVE_FIXTURE = "sk-super-secret-auth-payload-should-never-leak";

function callKind(options: SubprocessRunOptions): "version" | "login" {
  return options.args[0] === "--version" ? "version" : "login";
}

async function withFakeCodexHome(
  authFileContents: string | undefined,
  run: (codexHome: string) => Promise<void>,
): Promise<void> {
  const codexHome = await mkdtemp(join(tmpdir(), "primetime-codex-home-"));
  const previousCodexHome = process.env.CODEX_HOME;
  process.env.CODEX_HOME = codexHome;

  try {
    if (authFileContents !== undefined) {
      await writeFile(join(codexHome, "auth.json"), authFileContents, "utf8");
    }
    await run(codexHome);
  } finally {
    if (previousCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = previousCodexHome;
    }
    await rm(codexHome, { recursive: true, force: true });
  }
}

test("setup() rejects an unauthenticated local Codex login before reading any file", async () => {
  await withFakeCodexHome(SENSITIVE_FIXTURE, async () => {
    const subprocessRunner = new FakeSubprocessRunner((options) => {
      if (callKind(options) === "version") {
        return subprocessResult({ exitCode: 0 });
      }
      return subprocessResult({ exitCode: 1, stdout: "Not logged in" });
    });
    const ghRunner = new FakeGhRunner(() => {
      throw new Error("must not call gh when Codex itself is not authenticated");
    });
    const provider = new CodexProvider(subprocessRunner, ghRunner);

    const result = await provider.setup();

    assert.equal(result.configured, false);
    assert.equal(ghRunner.calls.length, 0);
  });
});

test("setup() reports a clear error when the local auth file is unreadable", async () => {
  await withFakeCodexHome(undefined, async () => {
    const subprocessRunner = new FakeSubprocessRunner((options) => {
      if (callKind(options) === "version") {
        return subprocessResult({ exitCode: 0 });
      }
      return subprocessResult({ exitCode: 0, stdout: "Logged in using ChatGPT" });
    });
    const ghRunner = new FakeGhRunner(() => {
      throw new Error("must not call gh when the auth file cannot be read");
    });
    const provider = new CodexProvider(subprocessRunner, ghRunner);

    const result = await provider.setup();

    assert.equal(result.configured, false);
    assert.equal(result.message, CODEX_SETUP_MESSAGES.authFileUnavailable);
    assert.equal(ghRunner.calls.length, 0);
  });
});

test("setup() reports a clear error when the repository cannot be resolved", async () => {
  await withFakeCodexHome(SENSITIVE_FIXTURE, async () => {
    const subprocessRunner = new FakeSubprocessRunner((options) => {
      if (callKind(options) === "version") {
        return subprocessResult({ exitCode: 0 });
      }
      return subprocessResult({ exitCode: 0, stdout: "Logged in using ChatGPT" });
    });
    const ghRunner = new FakeGhRunner(() => ghRunResult({ exitCode: 1 }));
    const provider = new CodexProvider(subprocessRunner, ghRunner);

    const result = await provider.setup();

    assert.equal(result.configured, false);
    assert.equal(result.message, CODEX_SETUP_MESSAGES.repositoryNotResolved);
  });
});

test("setup() transfers the local auth file to the resolved repository's secret without leaking it in args", async () => {
  await withFakeCodexHome(SENSITIVE_FIXTURE, async () => {
    const subprocessRunner = new FakeSubprocessRunner((options) => {
      if (callKind(options) === "version") {
        return subprocessResult({ exitCode: 0 });
      }
      return subprocessResult({ exitCode: 0, stdout: "Logged in using ChatGPT" });
    });
    const ghRunner = new FakeGhRunner((options) => {
      if (options.args[0] === "repo") {
        return ghRunResult({ stdout: JSON.stringify({ nameWithOwner: "RamiSmat/primetime" }) });
      }
      assert.deepEqual(options.args, [
        "secret",
        "set",
        "CODEX_AUTH_JSON",
        "--repo",
        "RamiSmat/primetime",
      ]);
      assert.equal(options.input, SENSITIVE_FIXTURE);
      assert.equal(JSON.stringify(options.args).includes(SENSITIVE_FIXTURE), false);
      return ghRunResult();
    });
    const provider = new CodexProvider(subprocessRunner, ghRunner);

    const result = await provider.setup();

    assert.equal(result.configured, true);
    assert.equal(result.message, CODEX_SETUP_MESSAGES.success);
  });
});

test("setup() reports a clear error when writing the secret fails", async () => {
  await withFakeCodexHome(SENSITIVE_FIXTURE, async () => {
    const subprocessRunner = new FakeSubprocessRunner((options) => {
      if (callKind(options) === "version") {
        return subprocessResult({ exitCode: 0 });
      }
      return subprocessResult({ exitCode: 0, stdout: "Logged in using ChatGPT" });
    });
    const ghRunner = new FakeGhRunner((options) => {
      if (options.args[0] === "repo") {
        return ghRunResult({ stdout: JSON.stringify({ nameWithOwner: "RamiSmat/primetime" }) });
      }
      return ghRunResult({ exitCode: 1, stderr: `denied: ${SENSITIVE_FIXTURE}` });
    });
    const provider = new CodexProvider(subprocessRunner, ghRunner);

    const result = await provider.setup();

    assert.equal(result.configured, false);
    assert.equal(result.message, CODEX_SETUP_MESSAGES.secretWriteFailed);
    assert.equal(result.message.includes(SENSITIVE_FIXTURE), false);
  });
});
