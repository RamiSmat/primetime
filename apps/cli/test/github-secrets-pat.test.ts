import assert from "node:assert/strict";
import test from "node:test";

import { PRIMETIME_SECRETS_PAT_NAME, setupGithubSecretsPat } from "../src/github-secrets-pat.js";

import { FakeGhRunner, ghRunResult } from "./support/fake-gh-runner.js";

const SENSITIVE_FIXTURE = "ghp_super-secret-pat-should-never-leak";

test("writes the PAT to PRIMETIME_SECRETS_PAT for the resolved repository, without leaking it in args", async () => {
  const ghRunner = new FakeGhRunner((options) => {
    if (options.args[0] === "repo") {
      return ghRunResult({ stdout: JSON.stringify({ nameWithOwner: "RamiSmat/primetime" }) });
    }
    assert.deepEqual(options.args, [
      "secret",
      "set",
      PRIMETIME_SECRETS_PAT_NAME,
      "--repo",
      "RamiSmat/primetime",
    ]);
    assert.equal(options.input, SENSITIVE_FIXTURE);
    assert.equal(JSON.stringify(options.args).includes(SENSITIVE_FIXTURE), false);
    return ghRunResult();
  });

  const message = await setupGithubSecretsPat(SENSITIVE_FIXTURE, ghRunner);

  assert.equal(message, `Stored ${PRIMETIME_SECRETS_PAT_NAME} for RamiSmat/primetime.`);
});

test("propagates a repository resolution failure", async () => {
  const ghRunner = new FakeGhRunner(() => ghRunResult({ exitCode: 1 }));

  await assert.rejects(setupGithubSecretsPat(SENSITIVE_FIXTURE, ghRunner));
});
