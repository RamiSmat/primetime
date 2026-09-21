import { importPKCS8, SignJWT } from "jose";

import { PrimeTimeError } from "@primetime/shared";

/** GitHub requires the App JWT's lifetime to be 10 minutes or less. */
const MAX_JWT_LIFETIME_SECONDS = 600;
/** Backdate `iat` to tolerate clock drift between this process and GitHub's servers, per GitHub's own App-auth guidance. */
const CLOCK_DRIFT_TOLERANCE_SECONDS = 60;

export class AppJwtSigningError extends PrimeTimeError {
  public constructor() {
    super(
      "invalid_configuration",
      "Could not sign the GitHub App JWT. Check that GITHUB_APP_PRIVATE_KEY_BASE64 decodes to a valid PKCS#8 PEM private key.",
    );
    this.name = "AppJwtSigningError";
  }
}

export interface SignAppJwtOptions {
  /** The GitHub App's numeric ID, used as the JWT issuer. */
  readonly appId: string;
  /** The App's private key, PEM-encoded (PKCS#8). */
  readonly privateKey: string;
}

/**
 * Signs a short-lived JWT identifying this process as the GitHub App itself
 * (not any particular installation). Used only to request installation
 * access tokens — never sent anywhere else, and never logged.
 */
export async function signAppJwt(options: SignAppJwtOptions): Promise<string> {
  try {
    const key = await importPKCS8(options.privateKey, "RS256");
    const now = Math.floor(Date.now() / 1000);

    return await new SignJWT({})
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(options.appId)
      .setIssuedAt(now - CLOCK_DRIFT_TOLERANCE_SECONDS)
      .setExpirationTime(now + MAX_JWT_LIFETIME_SECONDS)
      .sign(key);
  } catch (error) {
    if (error instanceof PrimeTimeError) {
      throw error;
    }
    throw new AppJwtSigningError();
  }
}
