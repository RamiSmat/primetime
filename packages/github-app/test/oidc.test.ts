import assert from "node:assert/strict";
import test from "node:test";

import { importPKCS8, SignJWT } from "jose";

import { OidcVerificationFailedError, verifyActionsOidcToken } from "../src/oidc.js";

import { FakeFetch, fakeFetchResponse } from "./support/fake-fetch.js";
import { createRsaFixture } from "./support/rsa-fixture.js";

const AUDIENCE = "https://primetime.example/api/actions/token";
const ISSUER = "https://token.actions.githubusercontent.com";

const fixture = createRsaFixture();

async function signFixtureToken(overrides: {
  issuer?: string;
  audience?: string;
  expiresInSeconds?: number;
} = {}): Promise<string> {
  const key = await importPKCS8(fixture.privateKeyPem, "RS256");
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({ repository: "RamiSmat/primetime", repository_owner: "RamiSmat" })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(overrides.issuer ?? ISSUER)
    .setAudience(overrides.audience ?? AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + (overrides.expiresInSeconds ?? 300))
    .sign(key);
}

function jwksFetch(): FakeFetch {
  return new FakeFetch(() => fakeFetchResponse({ body: { keys: [fixture.publicJwk] } }));
}

test("verifies a valid Actions OIDC token and returns its claims", async () => {
  const token = await signFixtureToken();
  const fetch = jwksFetch();

  const claims = await verifyActionsOidcToken(token, { audience: AUDIENCE }, fetch.fetch);

  assert.equal(claims["repository"], "RamiSmat/primetime");
  assert.equal(fetch.calls.length, 1);
  assert.equal(fetch.calls[0]!.input, `${ISSUER}/.well-known/jwks`);
});

test("rejects a token with a tampered signature", async () => {
  const token = await signFixtureToken();
  const tamperedChar = token[token.length - 5] === "a" ? "b" : "a";
  const tampered = token.slice(0, -5) + tamperedChar + token.slice(-4);
  const fetch = jwksFetch();

  await assert.rejects(
    verifyActionsOidcToken(tampered, { audience: AUDIENCE }, fetch.fetch),
    OidcVerificationFailedError,
  );
});

test("rejects a token issued for the wrong audience", async () => {
  const token = await signFixtureToken({ audience: "https://not-primetime.example" });
  const fetch = jwksFetch();

  await assert.rejects(
    verifyActionsOidcToken(token, { audience: AUDIENCE }, fetch.fetch),
    OidcVerificationFailedError,
  );
});

test("rejects an expired token", async () => {
  const token = await signFixtureToken({ expiresInSeconds: -60 });
  const fetch = jwksFetch();

  await assert.rejects(
    verifyActionsOidcToken(token, { audience: AUDIENCE }, fetch.fetch),
    OidcVerificationFailedError,
  );
});

test("rejects a token from the wrong issuer", async () => {
  const token = await signFixtureToken({ issuer: "https://not-github.example" });
  const fetch = jwksFetch();

  await assert.rejects(
    verifyActionsOidcToken(token, { audience: AUDIENCE }, fetch.fetch),
    OidcVerificationFailedError,
  );
});
