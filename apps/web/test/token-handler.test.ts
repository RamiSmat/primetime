import assert from "node:assert/strict";
import test from "node:test";

import type { ActionsOidcClaims, InstallationToken } from "@primetime/github-app";

import { InMemoryInstallationStore } from "../src/db/store.js";
import { handleActionsTokenRequest } from "../src/actions/token-handler.js";

const AUDIENCE = "https://primetime.example/api/actions/token";

function tokenRequest(bearerToken?: string): Request {
  const headers: Record<string, string> = {};
  if (bearerToken !== undefined) {
    headers["authorization"] = `Bearer ${bearerToken}`;
  }
  return new Request("https://primetime.example/api/actions/token", { method: "POST", headers });
}

const FIXED_CLAIMS: ActionsOidcClaims = {
  repository: "RamiSmat/primetime",
  repository_owner: "RamiSmat",
  ref: "refs/heads/main",
  workflow: "PrimeTime Codex primer",
  job_workflow_ref: "RamiSmat/primetime/.github/workflows/codex-prime-hosted.yml@refs/heads/main",
  run_id: "123",
};

test("rejects a request with no bearer token", async () => {
  const store = new InMemoryInstallationStore();
  const response = await handleActionsTokenRequest(tokenRequest(), {
    audience: AUDIENCE,
    appId: "1",
    privateKey: "unused",
    store,
  });

  assert.equal(response.status, 401);
});

test("rejects a token that fails OIDC verification", async () => {
  const store = new InMemoryInstallationStore();
  const response = await handleActionsTokenRequest(tokenRequest("bad-token"), {
    audience: AUDIENCE,
    appId: "1",
    privateKey: "unused",
    store,
    verifyToken: async () => {
      throw new Error("invalid");
    },
  });

  assert.equal(response.status, 401);
});

test("rejects a verified token for a repository with no installation", async () => {
  const store = new InMemoryInstallationStore();
  const response = await handleActionsTokenRequest(tokenRequest("good-token"), {
    audience: AUDIENCE,
    appId: "1",
    privateKey: "unused",
    store,
    verifyToken: async () => FIXED_CLAIMS,
  });

  assert.equal(response.status, 403);
});

test("mints a token scoped to exactly the requesting repository once an installation matches", async () => {
  const store = new InMemoryInstallationStore();
  await store.upsertInstallation({ installationId: 987, accountLogin: "RamiSmat" });
  await store.setRepositories(987, ["RamiSmat/primetime"]);

  let mintedWith: unknown;
  const fixedToken: InstallationToken = {
    token: "ghs_fixture",
    expiresAt: new Date("2026-01-01T00:00:00Z"),
  };

  const response = await handleActionsTokenRequest(tokenRequest("good-token"), {
    audience: AUDIENCE,
    appId: "1",
    privateKey: "unused",
    store,
    verifyToken: async () => FIXED_CLAIMS,
    mintToken: async (options) => {
      mintedWith = options;
      return fixedToken;
    },
  });

  assert.equal(response.status, 200);
  const json = (await response.json()) as { token: string; expiresAt: string };
  assert.equal(json.token, "ghs_fixture");
  assert.equal(json.expiresAt, "2026-01-01T00:00:00.000Z");
  assert.deepEqual(mintedWith, {
    appId: "1",
    privateKey: "unused",
    installationId: 987,
    repository: "RamiSmat/primetime",
    permissions: { secrets: "write" },
  });
});
