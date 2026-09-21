import assert from "node:assert/strict";
import test from "node:test";

import { GhCliUnavailableError, RepositoryNotResolvedError, resolveRepository } from "../src/repository.js";

import { FakeGhRunner, ghRunResult } from "./support/fake-gh-runner.js";

test("resolves the owner and name from gh repo view", async () => {
  const runner = new FakeGhRunner(() =>
    ghRunResult({ stdout: JSON.stringify({ nameWithOwner: "RamiSmat/primetime" }) }),
  );

  const repository = await resolveRepository(runner, undefined, {});

  assert.deepEqual(repository, { owner: "RamiSmat", name: "primetime" });
  assert.deepEqual(runner.calls[0]?.args, ["repo", "view", "--json", "nameWithOwner"]);
});

test("throws GhCliUnavailableError when gh is not installed", async () => {
  const runner = new FakeGhRunner(() => ghRunResult({ exitCode: null, executableMissing: true }));

  await assert.rejects(resolveRepository(runner, undefined, {}), GhCliUnavailableError);
});

test("throws RepositoryNotResolvedError on a nonzero exit", async () => {
  const runner = new FakeGhRunner(() => ghRunResult({ exitCode: 1 }));

  await assert.rejects(resolveRepository(runner, undefined, {}), RepositoryNotResolvedError);
});

test("throws RepositoryNotResolvedError on a timeout", async () => {
  const runner = new FakeGhRunner(() => ghRunResult({ exitCode: null, timedOut: true }));

  await assert.rejects(resolveRepository(runner, undefined, {}), RepositoryNotResolvedError);
});

test("throws RepositoryNotResolvedError on malformed JSON", async () => {
  const runner = new FakeGhRunner(() => ghRunResult({ stdout: "not json" }));

  await assert.rejects(resolveRepository(runner, undefined, {}), RepositoryNotResolvedError);
});

test("throws RepositoryNotResolvedError when nameWithOwner is missing", async () => {
  const runner = new FakeGhRunner(() => ghRunResult({ stdout: JSON.stringify({}) }));

  await assert.rejects(resolveRepository(runner, undefined, {}), RepositoryNotResolvedError);
});

test("uses GH_REPO directly without calling gh, when set", async () => {
  const runner = new FakeGhRunner(() => {
    throw new Error("must not call gh when GH_REPO is set");
  });

  const repository = await resolveRepository(runner, undefined, { GH_REPO: "someone/somewhere" });

  assert.deepEqual(repository, { owner: "someone", name: "somewhere" });
  assert.equal(runner.calls.length, 0);
});

test("falls back to gh repo view when GH_REPO is blank", async () => {
  const runner = new FakeGhRunner(() =>
    ghRunResult({ stdout: JSON.stringify({ nameWithOwner: "RamiSmat/primetime" }) }),
  );

  const repository = await resolveRepository(runner, undefined, { GH_REPO: "   " });

  assert.deepEqual(repository, { owner: "RamiSmat", name: "primetime" });
  assert.equal(runner.calls.length, 1);
});

test("throws RepositoryNotResolvedError for a malformed GH_REPO", async () => {
  const runner = new FakeGhRunner(() => {
    throw new Error("must not call gh for a malformed GH_REPO");
  });

  await assert.rejects(
    resolveRepository(runner, undefined, { GH_REPO: "not-owner-slash-repo" }),
    RepositoryNotResolvedError,
  );
});
