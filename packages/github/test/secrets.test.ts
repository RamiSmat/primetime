import assert from "node:assert/strict";
import test from "node:test";

import { GhCliUnavailableError } from "../src/repository.js";
import { SecretWriteFailedError, setRepositorySecret } from "../src/secrets.js";

import { FakeGhRunner, ghRunResult } from "./support/fake-gh-runner.js";

const REPOSITORY = { owner: "RamiSmat", name: "primetime" };
const SENSITIVE_FIXTURE = "sk-super-secret-should-never-leak";

test("sets a repository secret via gh secret set, with the value only on stdin", async () => {
  const runner = new FakeGhRunner(() => ghRunResult());

  await setRepositorySecret(
    { name: "CODEX_AUTH_JSON", value: SENSITIVE_FIXTURE, repository: REPOSITORY },
    runner,
  );

  assert.equal(runner.calls.length, 1);
  const call = runner.calls[0]!;
  assert.deepEqual(call.args, ["secret", "set", "CODEX_AUTH_JSON", "--repo", "RamiSmat/primetime"]);
  assert.equal(call.input, SENSITIVE_FIXTURE);
  assert.equal(JSON.stringify(call.args).includes(SENSITIVE_FIXTURE), false);
});

test("throws GhCliUnavailableError when gh is not installed", async () => {
  const runner = new FakeGhRunner(() => ghRunResult({ exitCode: null, executableMissing: true }));

  await assert.rejects(
    setRepositorySecret({ name: "CODEX_AUTH_JSON", value: "x", repository: REPOSITORY }, runner),
    GhCliUnavailableError,
  );
});

test("throws SecretWriteFailedError on a nonzero exit, without leaking stderr", async () => {
  const runner = new FakeGhRunner(() =>
    ghRunResult({ exitCode: 1, stderr: `permission denied for token ${SENSITIVE_FIXTURE}` }),
  );

  await assert.rejects(
    setRepositorySecret({ name: "CODEX_AUTH_JSON", value: "x", repository: REPOSITORY }, runner),
    (error: unknown) => {
      assert.ok(error instanceof SecretWriteFailedError);
      assert.equal(error.message.includes(SENSITIVE_FIXTURE), false);
      return true;
    },
  );
});

test("throws SecretWriteFailedError on a timeout", async () => {
  const runner = new FakeGhRunner(() => ghRunResult({ exitCode: null, timedOut: true }));

  await assert.rejects(
    setRepositorySecret({ name: "CODEX_AUTH_JSON", value: "x", repository: REPOSITORY }, runner),
    SecretWriteFailedError,
  );
});
