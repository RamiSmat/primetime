import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from "jose";

import { PrimeTimeError } from "@primetime/shared";

import type { FetchLike } from "./fetch-like.js";

const OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const JWKS_URL = `${OIDC_ISSUER}/.well-known/jwks`;
const JWKS_FETCH_TIMEOUT_MS = 10_000;

export class OidcVerificationFailedError extends PrimeTimeError {
  public constructor() {
    super(
      "unknown_failure",
      "Could not verify the GitHub Actions OIDC token. It may be expired, issued for a different audience, or the runner may not belong to a trusted repository.",
    );
    this.name = "OidcVerificationFailedError";
  }
}

export class OidcJwksFetchFailedError extends PrimeTimeError {
  public constructor() {
    super(
      "network_failure",
      "Could not fetch GitHub Actions' OIDC signing keys to verify the token.",
    );
    this.name = "OidcJwksFetchFailedError";
  }
}

export interface VerifyActionsOidcTokenOptions {
  /** The `aud` claim this token must have been requested with (must match `OIDC_AUDIENCE`). */
  readonly audience: string;
}

/**
 * Claims this exchange relies on from a GitHub Actions OIDC token. See
 * https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect
 * for the full claim set — only the ones this package uses are typed here.
 */
export interface ActionsOidcClaims {
  readonly repository: string;
  readonly repository_owner: string;
  readonly ref: string;
  readonly workflow: string;
  readonly job_workflow_ref: string;
  readonly run_id: string;
  readonly [claim: string]: unknown;
}

function isJsonWebKeySet(value: unknown): value is JSONWebKeySet {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as Record<string, unknown>)["keys"])
  );
}

/**
 * Verifies a GitHub Actions "id-token" against GitHub's own published JWKS
 * (signature, issuer, audience, expiry) and returns its claims. This is the
 * sole trust boundary for the token-exchange endpoint: only a runner that
 * can prove it is executing a specific workflow run in a specific
 * repository, as attested by GitHub itself, gets past this check. The
 * Codex session this run is priming never passes through here or anywhere
 * else in this package.
 */
export async function verifyActionsOidcToken(
  token: string,
  options: VerifyActionsOidcTokenOptions,
  fetchImpl: FetchLike = fetch,
): Promise<ActionsOidcClaims> {
  let jwks: JSONWebKeySet;
  try {
    const response = await fetchImpl(JWKS_URL, {
      signal: AbortSignal.timeout(JWKS_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new OidcJwksFetchFailedError();
    }
    const body: unknown = await response.json();
    if (!isJsonWebKeySet(body)) {
      throw new OidcJwksFetchFailedError();
    }
    jwks = body;
  } catch (error) {
    if (error instanceof PrimeTimeError) {
      throw error;
    }
    throw new OidcJwksFetchFailedError();
  }

  try {
    const keySet = createLocalJWKSet(jwks);
    const { payload } = await jwtVerify(token, keySet, {
      issuer: OIDC_ISSUER,
      audience: options.audience,
    });
    return payload as ActionsOidcClaims;
  } catch {
    throw new OidcVerificationFailedError();
  }
}
