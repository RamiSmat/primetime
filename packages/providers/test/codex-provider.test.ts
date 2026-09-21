import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import { CodexProvider } from "../src/codex/index.js";
import { CODEX_FAILURE_MESSAGES, CODEX_SUCCESS_MESSAGE } from "../src/codex/messages.js";

import {
  FakeSubprocessRunner,
  subprocessResult,
} from "./support/fake-subprocess-runner.js";
import type { SubprocessRunOptions } from "../src/codex/process-runner.js";

const SENSITIVE_FIXTURE = "sk-super-secret-should-never-leak";

function callKind(options: SubprocessRunOptions): "version" | "login" | "exec" {
  if (options.args[0] === "--version") {
    return "version";
  }
  if (options.args[0] === "login") {
    return "login";
  }
  return "exec";
}

test("detect() reports unavailable when the executable is missing", async () => {
  const runner = new FakeSubprocessRunner(() =>
    subprocessResult({ exitCode: null, executableMissing: true }),
  );
  const provider = new CodexProvider(runner);

  assert.deepEqual(await provider.detect(), { available: false });
});

test("detect() reports available when --version succeeds", async () => {
  const runner = new FakeSubprocessRunner(() =>
    subprocessResult({ exitCode: 0, stdout: "codex-cli 0.155.1\n" }),
  );
  const provider = new CodexProvider(runner);

  assert.deepEqual(await provider.detect(), { available: true });
});

test("validateAuthentication() accepts a ChatGPT login", async () => {
  const runner = new FakeSubprocessRunner(() =>
    subprocessResult({ exitCode: 0, stdout: "Logged in using ChatGPT" }),
  );
  const provider = new CodexProvider(runner);

  assert.deepEqual(await provider.validateAuthentication(), {
    authenticated: true,
  });
});

test("validateAuthentication() rejects an API key login", async () => {
  const runner = new FakeSubprocessRunner(() =>
    subprocessResult({ exitCode: 0, stdout: "Logged in using an API key" }),
  );
  const provider = new CodexProvider(runner);

  assert.deepEqual(await provider.validateAuthentication(), {
    authenticated: false,
  });
});

test("prime() fails fast with cli_unavailable when the CLI cannot be found, without checking auth or running exec", async () => {
  const runner = new FakeSubprocessRunner((options) => {
    if (callKind(options) === "version") {
      return subprocessResult({ exitCode: null, executableMissing: true });
    }
    throw new Error("must not proceed past a missing executable");
  });
  const provider = new CodexProvider(runner);

  const result = await provider.prime();

  assert.equal(result.success, false);
  assert.equal(result.provider, "codex");
  assert.equal(result.errorCategory, "cli_unavailable");
  assert.equal(result.message, CODEX_FAILURE_MESSAGES.cli_unavailable);
  assert.equal(runner.calls.length, 1);
});

test("prime() rejects an API-key login before ever invoking exec", async () => {
  const runner = new FakeSubprocessRunner((options) => {
    const kind = callKind(options);
    if (kind === "version") {
      return subprocessResult({ exitCode: 0 });
    }
    if (kind === "login") {
      return subprocessResult({ exitCode: 0, stdout: `Logged in using an API key (${SENSITIVE_FIXTURE})` });
    }
    throw new Error("must not run the primer request when auth is rejected");
  });
  const provider = new CodexProvider(runner);

  const result = await provider.prime();

  assert.equal(result.success, false);
  assert.equal(result.errorCategory, "authentication_required");
  assert.equal(result.message.includes(SENSITIVE_FIXTURE), false);
  assert.equal(runner.calls.some((call) => callKind(call) === "exec"), false);
});

test("prime() rejects when not logged in at all", async () => {
  const runner = new FakeSubprocessRunner((options) => {
    const kind = callKind(options);
    if (kind === "version") {
      return subprocessResult({ exitCode: 0 });
    }
    if (kind === "login") {
      return subprocessResult({ exitCode: 1, stdout: "Not logged in" });
    }
    throw new Error("must not run the primer request when not authenticated");
  });
  const provider = new CodexProvider(runner);

  const result = await provider.prime();

  assert.equal(result.success, false);
  assert.equal(result.errorCategory, "authentication_required");
});

test("prime() succeeds end-to-end, running exec in a fresh temp directory with sanitized env, then cleans it up", async () => {
  let observedWorkspace: string | undefined;
  const runner = new FakeSubprocessRunner((options) => {
    const kind = callKind(options);
    if (kind === "version") {
      return subprocessResult({ exitCode: 0 });
    }
    if (kind === "login") {
      return subprocessResult({ exitCode: 0, stdout: "Logged in using ChatGPT" });
    }

    observedWorkspace = options.cwd;
    assert.ok(options.cwd?.includes("primetime-codex-"));
    assert.equal(existsSync(options.cwd ?? ""), true);
    assert.equal("OPENAI_API_KEY" in options.env, false);
    assert.equal("CODEX_API_KEY" in options.env, false);
    assert.ok(options.args.includes("--sandbox"));
    assert.ok(options.args.includes("read-only"));
    assert.ok(options.args.includes("--ephemeral"));
    return subprocessResult({ exitCode: 0, stdout: "OK" });
  });

  const provider = new CodexProvider(runner);
  const result = await provider.prime();

  assert.equal(result.success, true);
  assert.equal(result.errorCategory, null);
  assert.equal(result.message, CODEX_SUCCESS_MESSAGE);
  assert.equal(typeof result.durationMs, "number");
  assert.ok(observedWorkspace !== undefined);
  assert.equal(existsSync(observedWorkspace ?? ""), false);
});

test("prime() classifies a rate limit failure without leaking raw stderr", async () => {
  const runner = new FakeSubprocessRunner((options) => {
    const kind = callKind(options);
    if (kind === "version") {
      return subprocessResult({ exitCode: 0 });
    }
    if (kind === "login") {
      return subprocessResult({ exitCode: 0, stdout: "Logged in using ChatGPT" });
    }
    return subprocessResult({
      exitCode: 1,
      stderr: `usage limit reached, token=${SENSITIVE_FIXTURE}`,
    });
  });
  const provider = new CodexProvider(runner);

  const result = await provider.prime();

  assert.equal(result.success, false);
  assert.equal(result.errorCategory, "rate_limited");
  assert.equal(result.message, CODEX_FAILURE_MESSAGES.rate_limited);
  assert.equal(result.message.includes(SENSITIVE_FIXTURE), false);
});

test("prime() classifies a timeout during the primer request", async () => {
  const runner = new FakeSubprocessRunner((options) => {
    const kind = callKind(options);
    if (kind === "version") {
      return subprocessResult({ exitCode: 0 });
    }
    if (kind === "login") {
      return subprocessResult({ exitCode: 0, stdout: "Logged in using ChatGPT" });
    }
    return subprocessResult({ exitCode: null, timedOut: true });
  });
  const provider = new CodexProvider(runner);

  const result = await provider.prime();

  assert.equal(result.success, false);
  assert.equal(result.errorCategory, "timeout");
  assert.equal(result.message, CODEX_FAILURE_MESSAGES.timeout);
});
