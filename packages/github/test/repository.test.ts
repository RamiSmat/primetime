import assert from "node:assert/strict";
import test from "node:test";

import { GhCliUnavailableError, RepositoryNotResolvedError, resolveRepository } from "../src/repository.js";

import { FakeGhRunner, ghRunResult } from "./support/fake-gh-runner.js";

test("resolves the owner and name from gh repo view", async () => {
  const runner = new FakeGhRunner(() =>
    ghRunResult({ stdout: JSON.stringify({ nameWithOwner: "RamiSmat/primetime" }) }),
  );

  const repository = await resolveRepository(runner);

  assert.deepEqual(repository, { owner: "RamiSmat", name: "primetime" });
  assert.deepEqual(runner.calls[0]?.args, ["repo", "view", "--json", "nameWithOwner"]);
});

test("throws GhCliUnavailableError when gh is not installed", async () => {
  const runner = new FakeGhRunner(() => ghRunResult({ exitCode: null, executableMissing: true }));

  await assert.rejects(resolveRepository(runner), GhCliUnavailableError);
});

test("throws RepositoryNotResolvedError on a nonzero exit", async () => {
  const runner = new FakeGhRunner(() => ghRunResult({ exitCode: 1 }));

  await assert.rejects(resolveRepository(runner), RepositoryNotResolvedError);
});

test("throws RepositoryNotResolvedError on a timeout", async () => {
  const runner = new FakeGhRunner(() => ghRunResult({ exitCode: null, timedOut: true }));

  await assert.rejects(resolveRepository(runner), RepositoryNotResolvedError);
});

test("throws RepositoryNotResolvedError on malformed JSON", async () => {
  const runner = new FakeGhRunner(() => ghRunResult({ stdout: "not json" }));

  await assert.rejects(resolveRepository(runner), RepositoryNotResolvedError);
});

test("throws RepositoryNotResolvedError when nameWithOwner is missing", async () => {
  const runner = new FakeGhRunner(() => ghRunResult({ stdout: JSON.stringify({}) }));

  await assert.rejects(resolveRepository(runner), RepositoryNotResolvedError);
});
