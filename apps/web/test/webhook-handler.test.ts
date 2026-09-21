import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

import { handleGithubWebhook } from "../src/github/webhook-handler.js";
import { InMemoryInstallationStore } from "../src/db/store.js";

const SECRET = "webhook-secret-fixture";

function webhookRequest(event: string, body: unknown, secret: string = SECRET): Request {
  const rawBody = JSON.stringify(body);
  const signature = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  return new Request("https://primetime.example/api/github/webhook", {
    method: "POST",
    headers: { "x-github-event": event, "x-hub-signature-256": signature },
    body: rawBody,
  });
}

test("rejects a webhook delivery with an invalid signature", async () => {
  const store = new InMemoryInstallationStore();
  const request = webhookRequest(
    "installation",
    { action: "created", installation: { id: 1, account: { login: "RamiSmat" } } },
    "wrong-secret",
  );

  const response = await handleGithubWebhook(request, { secret: SECRET, store });

  assert.equal(response.status, 401);
  assert.equal(await store.findInstallationForRepository("RamiSmat/primetime"), undefined);
});

test("records a new installation and its repositories on installation.created", async () => {
  const store = new InMemoryInstallationStore();
  const request = webhookRequest("installation", {
    action: "created",
    installation: { id: 42, account: { login: "RamiSmat" } },
    repositories: [{ full_name: "RamiSmat/primetime" }],
  });

  const response = await handleGithubWebhook(request, { secret: SECRET, store });

  assert.equal(response.status, 200);
  const installation = await store.findInstallationForRepository("RamiSmat/primetime");
  assert.deepEqual(installation, { installationId: 42, accountLogin: "RamiSmat" });
});

test("removes an installation on installation.deleted", async () => {
  const store = new InMemoryInstallationStore();
  await store.upsertInstallation({ installationId: 42, accountLogin: "RamiSmat" });
  await store.setRepositories(42, ["RamiSmat/primetime"]);

  const request = webhookRequest("installation", {
    action: "deleted",
    installation: { id: 42, account: { login: "RamiSmat" } },
  });

  await handleGithubWebhook(request, { secret: SECRET, store });

  assert.equal(await store.findInstallationForRepository("RamiSmat/primetime"), undefined);
});

test("adds and removes repositories on installation_repositories events", async () => {
  const store = new InMemoryInstallationStore();
  await store.upsertInstallation({ installationId: 42, accountLogin: "RamiSmat" });
  await store.setRepositories(42, ["RamiSmat/primetime"]);

  const addRequest = webhookRequest("installation_repositories", {
    action: "added",
    installation: { id: 42, account: { login: "RamiSmat" } },
    repositories_added: [{ full_name: "RamiSmat/second-repo" }],
  });
  await handleGithubWebhook(addRequest, { secret: SECRET, store });

  assert.ok(await store.findInstallationForRepository("RamiSmat/second-repo"));

  const removeRequest = webhookRequest("installation_repositories", {
    action: "removed",
    installation: { id: 42, account: { login: "RamiSmat" } },
    repositories_removed: [{ full_name: "RamiSmat/primetime" }],
  });
  await handleGithubWebhook(removeRequest, { secret: SECRET, store });

  assert.equal(await store.findInstallationForRepository("RamiSmat/primetime"), undefined);
  assert.ok(await store.findInstallationForRepository("RamiSmat/second-repo"));
});
