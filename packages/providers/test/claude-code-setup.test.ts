import assert from "node:assert/strict";
import test from "node:test";

import { ClaudeCodeProvider } from "../src/claude-code/index.js";
import { CLAUDE_CODE_SETUP_MESSAGES } from "../src/claude-code/messages.js";

import { FakeGhRunner, ghRunResult } from "./support/fake-gh-runner.js";
import {
  FakeSubprocessRunner,
  subprocessResult,
} from "./support/fake-subprocess-runner.js";
import type { SubprocessRunOptions } from "../src/codex/process-runner.js";

const SENSITIVE_FIXTURE = "ci-oauth-token-should-never-leak";

function callKind(options: SubprocessRunOptions): "version" | "auth" {
  return options.args[0] === "--version" ? "version" : "auth";
}

function fakeReadInput(value: string): () => Promise<string> {
  return () => Promise.resolve(value);
}

test("setup() rejects empty stdin input without checking auth or calling gh", async () => {
  const subprocessRunner = new FakeSubprocessRunner(() => {
    throw new Error("must not check auth when no token was provided");
  });
  const ghRunner = new FakeGhRunner(() => {
    throw new Error("must not call gh when no token was provided");
  });
  const provider = new ClaudeCodeProvider(subprocessRunner, ghRunner, fakeReadInput("   \n"));

  const result = await provider.setup();

  assert.equal(result.configured, false);
  assert.equal(result.message, CLAUDE_CODE_SETUP_MESSAGES.tokenMissing);
  assert.equal(ghRunner.calls.length, 0);
});

test("setup() rejects a token that does not authenticate, before calling gh", async () => {
  const subprocessRunner = new FakeSubprocessRunner((options) => {
    if (callKind(options) === "version") {
      return subprocessResult({ exitCode: 0 });
    }
    return subprocessResult({
      exitCode: 1,
      stdout: JSON.stringify({ loggedIn: false }),
    });
  });
  const ghRunner = new FakeGhRunner(() => {
    throw new Error("must not call gh when the token does not authenticate");
  });
  const provider = new ClaudeCodeProvider(subprocessRunner, ghRunner, fakeReadInput(SENSITIVE_FIXTURE));

  const result = await provider.setup();

  assert.equal(result.configured, false);
  assert.equal(ghRunner.calls.length, 0);
});

test("setup() reports a clear error when the repository cannot be resolved", async () => {
  const subprocessRunner = new FakeSubprocessRunner((options) => {
    if (callKind(options) === "version") {
      return subprocessResult({ exitCode: 0 });
    }
    return subprocessResult({
      exitCode: 0,
      stdout: JSON.stringify({ loggedIn: true, authMethod: "oauth_token", apiProvider: "firstParty" }),
    });
  });
  const ghRunner = new FakeGhRunner(() => ghRunResult({ exitCode: 1 }));
  const provider = new ClaudeCodeProvider(subprocessRunner, ghRunner, fakeReadInput(SENSITIVE_FIXTURE));

  const result = await provider.setup();

  assert.equal(result.configured, false);
  assert.equal(result.message, CLAUDE_CODE_SETUP_MESSAGES.repositoryNotResolved);
});

test("setup() transfers the token to the resolved repository's secret without leaking it in args", async () => {
  const subprocessRunner = new FakeSubprocessRunner((options) => {
    if (callKind(options) === "version") {
      return subprocessResult({ exitCode: 0 });
    }
    assert.equal(options.env.CLAUDE_CODE_OAUTH_TOKEN, SENSITIVE_FIXTURE);
    return subprocessResult({
      exitCode: 0,
      stdout: JSON.stringify({ loggedIn: true, authMethod: "oauth_token", apiProvider: "firstParty" }),
    });
  });
  const ghRunner = new FakeGhRunner((options) => {
    if (options.args[0] === "repo") {
      return ghRunResult({ stdout: JSON.stringify({ nameWithOwner: "RamiSmat/primetime" }) });
    }
    assert.deepEqual(options.args, [
      "secret",
      "set",
      "CLAUDE_CODE_OAUTH_TOKEN",
      "--repo",
      "RamiSmat/primetime",
    ]);
    assert.equal(options.input, SENSITIVE_FIXTURE);
    assert.equal(JSON.stringify(options.args).includes(SENSITIVE_FIXTURE), false);
    return ghRunResult();
  });
  const provider = new ClaudeCodeProvider(subprocessRunner, ghRunner, fakeReadInput(SENSITIVE_FIXTURE));

  const result = await provider.setup();

  assert.equal(result.configured, true);
  assert.equal(result.message, CLAUDE_CODE_SETUP_MESSAGES.success);
});

test("setup() trims surrounding whitespace from the pasted token", async () => {
  const subprocessRunner = new FakeSubprocessRunner((options) => {
    if (callKind(options) === "version") {
      return subprocessResult({ exitCode: 0 });
    }
    return subprocessResult({
      exitCode: 0,
      stdout: JSON.stringify({ loggedIn: true, authMethod: "oauth_token", apiProvider: "firstParty" }),
    });
  });
  const ghRunner = new FakeGhRunner((options) => {
    if (options.args[0] === "repo") {
      return ghRunResult({ stdout: JSON.stringify({ nameWithOwner: "RamiSmat/primetime" }) });
    }
    assert.equal(options.input, SENSITIVE_FIXTURE);
    return ghRunResult();
  });
  const provider = new ClaudeCodeProvider(subprocessRunner, ghRunner, fakeReadInput(`  ${SENSITIVE_FIXTURE}\n`));

  const result = await provider.setup();

  assert.equal(result.configured, true);
});

test("setup() reports a clear error when writing the secret fails", async () => {
  const subprocessRunner = new FakeSubprocessRunner((options) => {
    if (callKind(options) === "version") {
      return subprocessResult({ exitCode: 0 });
    }
    return subprocessResult({
      exitCode: 0,
      stdout: JSON.stringify({ loggedIn: true, authMethod: "oauth_token", apiProvider: "firstParty" }),
    });
  });
  const ghRunner = new FakeGhRunner((options) => {
    if (options.args[0] === "repo") {
      return ghRunResult({ stdout: JSON.stringify({ nameWithOwner: "RamiSmat/primetime" }) });
    }
    return ghRunResult({ exitCode: 1, stderr: `denied: ${SENSITIVE_FIXTURE}` });
  });
  const provider = new ClaudeCodeProvider(subprocessRunner, ghRunner, fakeReadInput(SENSITIVE_FIXTURE));

  const result = await provider.setup();

  assert.equal(result.configured, false);
  assert.equal(result.message, CLAUDE_CODE_SETUP_MESSAGES.secretWriteFailed);
  assert.equal(result.message.includes(SENSITIVE_FIXTURE), false);
});
