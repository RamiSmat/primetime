import assert from "node:assert/strict";
import test from "node:test";

import { importJWK, jwtVerify } from "jose";

import { AppJwtSigningError, signAppJwt } from "../src/app-jwt.js";

import { createRsaFixture } from "./support/rsa-fixture.js";

test("signs an App JWT with iss/iat/exp within GitHub's required bounds", async () => {
  const fixture = createRsaFixture();

  const jwt = await signAppJwt({ appId: "123456", privateKey: fixture.privateKeyPem });

  const publicKey = await importJWK(fixture.publicJwk, "RS256");
  const { payload } = await jwtVerify(jwt, publicKey);

  assert.equal(payload["iss"], "123456");
  const now = Math.floor(Date.now() / 1000);
  assert.ok(payload.iat! <= now, "iat should not be in the future");
  assert.ok(now - payload.iat! <= 120, "iat should only be backdated for clock drift");
  assert.ok(payload.exp! - now <= 600, "lifetime must not exceed GitHub's 10-minute cap");
});

test("throws AppJwtSigningError for a malformed private key, without leaking it", async () => {
  const badKey = "not-a-real-private-key";

  await assert.rejects(
    signAppJwt({ appId: "123456", privateKey: badKey }),
    (error: unknown) => {
      assert.ok(error instanceof AppJwtSigningError);
      assert.equal(error.message.includes(badKey), false);
      return true;
    },
  );
});
