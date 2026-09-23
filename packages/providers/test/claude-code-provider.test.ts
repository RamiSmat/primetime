import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import { ClaudeCodeProvider } from "../src/claude-code/index.js";
import { CLAUDE_CODE_FAILURE_MESSAGES, CLAUDE_CODE_SUCCESS_MESSAGE } from "../src/claude-code/messages.js";

import {
  FakeSubprocessRunner,
  subprocessResult,
} from "./support/fake-subprocess-runner.js";
import type { SubprocessRunOptions } from "../src/codex/process-runner.js";

const SENSITIVE_FIXTURE = "sk-super-secret-should-never-leak";

function callKind(options: SubprocessRunOptions): "version" | "auth" | "exec" {
  if (options.args[0] === "--version") {
    return "version";
  }
  if (options.args[0] === "auth") {
    return "auth";
  }
  return "exec";
}

const SUBSCRIPTION_LOGIN_JSON = JSON.stringify({
  loggedIn: true,
  authMethod: "claude.ai",
  apiProvider: "firstParty",
});

test("detect() reports unavailable when the executable is missing", async () => {
  const runner = new FakeSubprocessRunner(() =>
    subprocessResult({ exitCode: null, executableMissing: true }),
  );
  const provider = new ClaudeCodeProvider(runner);

  assert.deepEqual(await provider.detect(), { available: false });
});

test("detect() reports available when --version succeeds", async () => {
  const runner = new FakeSubprocessRunner(() =>
    subprocessResult({ exitCode: 0, stdout: "2.1.278 (Claude Code)\n" }),
  );
  const provider = new ClaudeCodeProvider(runner);

  assert.deepEqual(await provider.detect(), { available: true });
});

test("validateAuthentication() accepts a claude.ai subscription login", async () => {
  const runner = new FakeSubprocessRunner(() =>
    subprocessResult({ exitCode: 0, stdout: SUBSCRIPTION_LOGIN_JSON }),
  );
  const provider = new ClaudeCodeProvider(runner);

  assert.deepEqual(await provider.validateAuthentication(), {
    authenticated: true,
  });
});

test("validateAuthentication() rejects an API-key-backed login", async () => {
  const runner = new FakeSubprocessRunner(() =>
    subprocessResult({
      exitCode: 0,
      stdout: JSON.stringify({ loggedIn: true, apiKeySource: "ANTHROPIC_API_KEY" }),
    }),
  );
  const provider = new ClaudeCodeProvider(runner);

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
  const provider = new ClaudeCodeProvider(runner);

  const result = await provider.prime();

  assert.equal(result.success, false);
  assert.equal(result.provider, "claude-code");
  assert.equal(result.errorCategory, "cli_unavailable");
  assert.equal(result.message, CLAUDE_CODE_FAILURE_MESSAGES.cli_unavailable);
  assert.equal(runner.calls.length, 1);
});

test("prime() rejects an API-key login before ever invoking the primer", async () => {
  const runner = new FakeSubprocessRunner((options) => {
    const kind = callKind(options);
    if (kind === "version") {
      return subprocessResult({ exitCode: 0 });
    }
    if (kind === "auth") {
      return subprocessResult({
        exitCode: 0,
        stdout: JSON.stringify({ loggedIn: true, apiKeySource: SENSITIVE_FIXTURE }),
      });
    }
    throw new Error("must not run the primer request when auth is rejected");
  });
  const provider = new ClaudeCodeProvider(runner);

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
    if (kind === "auth") {
      return subprocessResult({ exitCode: 1, stdout: JSON.stringify({ loggedIn: false }) });
    }
    throw new Error("must not run the primer request when not authenticated");
  });
  const provider = new ClaudeCodeProvider(runner);

  const result = await provider.prime();

  assert.equal(result.success, false);
  assert.equal(result.errorCategory, "authentication_required");
});

test("prime() succeeds end-to-end, running the primer in a fresh temp directory with sanitized env, then cleans it up", async () => {
  let observedWorkspace: string | undefined;
  const runner = new FakeSubprocessRunner((options) => {
    const kind = callKind(options);
    if (kind === "version") {
      return subprocessResult({ exitCode: 0 });
    }
    if (kind === "auth") {
      return subprocessResult({ exitCode: 0, stdout: SUBSCRIPTION_LOGIN_JSON });
    }

    observedWorkspace = options.cwd;
    assert.ok(options.cwd?.includes("primetime-claude-code-"));
    assert.equal(existsSync(options.cwd ?? ""), true);
    assert.equal("ANTHROPIC_API_KEY" in options.env, false);
    assert.equal("ANTHROPIC_AUTH_TOKEN" in options.env, false);
    assert.ok(options.args.includes("--disallowedTools"));
    assert.ok(options.args.includes("--permission-mode"));
    assert.ok(options.args.includes("plan"));
    return subprocessResult({ exitCode: 0, stdout: JSON.stringify({ is_error: false, result: "ok" }) });
  });

  const provider = new ClaudeCodeProvider(runner);
  const result = await provider.prime();

  assert.equal(result.success, true);
  assert.equal(result.errorCategory, null);
  assert.equal(result.message, CLAUDE_CODE_SUCCESS_MESSAGE);
  assert.equal(typeof result.durationMs, "number");
  assert.ok(observedWorkspace !== undefined);
  assert.equal(existsSync(observedWorkspace ?? ""), false);
});

test("prime() classifies a rate limit failure without leaking raw output", async () => {
  const runner = new FakeSubprocessRunner((options) => {
    const kind = callKind(options);
    if (kind === "version") {
      return subprocessResult({ exitCode: 0 });
    }
    if (kind === "auth") {
      return subprocessResult({ exitCode: 0, stdout: SUBSCRIPTION_LOGIN_JSON });
    }
    return subprocessResult({
      exitCode: 1,
      stdout: JSON.stringify({
        is_error: true,
        api_error_status: 429,
        result: `Rate limit reached, token=${SENSITIVE_FIXTURE}`,
      }),
    });
  });
  const provider = new ClaudeCodeProvider(runner);

  const result = await provider.prime();

  assert.equal(result.success, false);
  assert.equal(result.errorCategory, "rate_limited");
  assert.equal(result.message, CLAUDE_CODE_FAILURE_MESSAGES.rate_limited);
  assert.equal(result.message.includes(SENSITIVE_FIXTURE), false);
});

test("prime() classifies a timeout during the primer request", async () => {
  const runner = new FakeSubprocessRunner((options) => {
    const kind = callKind(options);
    if (kind === "version") {
      return subprocessResult({ exitCode: 0 });
    }
    if (kind === "auth") {
      return subprocessResult({ exitCode: 0, stdout: SUBSCRIPTION_LOGIN_JSON });
    }
    return subprocessResult({ exitCode: null, timedOut: true });
  });
  const provider = new ClaudeCodeProvider(runner);

  const result = await provider.prime();

  assert.equal(result.success, false);
  assert.equal(result.errorCategory, "timeout");
  assert.equal(result.message, CLAUDE_CODE_FAILURE_MESSAGES.timeout);
});
