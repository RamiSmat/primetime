import { generateKeyPairSync } from "node:crypto";

import type { JWK } from "jose";

/**
 * A throwaway RSA keypair generated fresh for the test run — never a real
 * GitHub App key, and never persisted. Lets tests sign and verify JWTs
 * end-to-end without any real GitHub App or network access.
 */
export interface RsaFixture {
  readonly privateKeyPem: string;
  readonly publicJwk: JWK;
}

export function createRsaFixture(): RsaFixture {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

  const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const publicJwk = publicKey.export({ format: "jwk" }) as JWK;

  return {
    privateKeyPem,
    publicJwk: { ...publicJwk, alg: "RS256", use: "sig", kid: "test-key" },
  };
}
