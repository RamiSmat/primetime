import assert from "node:assert/strict";
import test from "node:test";

import { InstallationTokenRequestFailedError, mintInstallationToken } from "../src/installation-token.js";
import type { FetchLike } from "../src/fetch-like.js";

import { FakeFetch, fakeFetchResponse } from "./support/fake-fetch.js";
import { createRsaFixture } from "./support/rsa-fixture.js";

const fixture = createRsaFixture();

test("requests a token scoped to exactly the given repository and permissions", async () => {
  const fetch = new FakeFetch(() =>
    fakeFetchResponse({ body: { token: "ghs_fixture_token", expires_at: "2026-01-01T00:00:00Z" } }),
  );

  const result = await mintInstallationToken(
    {
      appId: "123456",
      privateKey: fixture.privateKeyPem,
      installationId: 987,
      repository: "RamiSmat/primetime",
      permissions: { secrets: "write" },
    },
    fetch.fetch,
  );

  assert.equal(result.token, "ghs_fixture_token");
  assert.deepEqual(result.expiresAt, new Date("2026-01-01T00:00:00Z"));

  assert.equal(fetch.calls.length, 1);
  const call = fetch.calls[0]!;
  assert.equal(call.input, "https://api.github.com/app/installations/987/access_tokens");
  assert.equal(call.init?.method, "POST");
  const body = JSON.parse(call.init?.body ?? "{}") as {
    repositories: string[];
    permissions: Record<string, string>;
  };
  assert.deepEqual(body.repositories, ["RamiSmat/primetime"]);
  assert.deepEqual(body.permissions, { secrets: "write" });
});

test("throws InstallationTokenRequestFailedError on a non-2xx response, without leaking the private key", async () => {
  const fetch = new FakeFetch(() => fakeFetchResponse({ ok: false, status: 403, body: {} }));

  await assert.rejects(
    mintInstallationToken(
      {
        appId: "123456",
        privateKey: fixture.privateKeyPem,
        installationId: 987,
        repository: "RamiSmat/primetime",
        permissions: { secrets: "write" },
      },
      fetch.fetch,
    ),
    (error: unknown) => {
      assert.ok(error instanceof InstallationTokenRequestFailedError);
      assert.equal(error.message.includes(fixture.privateKeyPem), false);
      return true;
    },
  );
});

test("throws InstallationTokenRequestFailedError when the network call itself fails", async () => {
  const failingFetch: FetchLike = async () => {
    throw new Error("network down");
  };

  await assert.rejects(
    mintInstallationToken(
      {
        appId: "123456",
        privateKey: fixture.privateKeyPem,
        installationId: 987,
        repository: "RamiSmat/primetime",
        permissions: { secrets: "write" },
      },
      failingFetch,
    ),
    InstallationTokenRequestFailedError,
  );
});
