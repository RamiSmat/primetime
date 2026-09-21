import { PrimeTimeError } from "@primetime/shared";

import { signAppJwt } from "./app-jwt.js";
import type { FetchLike } from "./fetch-like.js";

const GITHUB_API_VERSION = "2022-11-28";
const INSTALLATION_TOKEN_TIMEOUT_MS = 10_000;

export class InstallationTokenRequestFailedError extends PrimeTimeError {
  public constructor() {
    super(
      "network_failure",
      "Could not mint a GitHub App installation token. Check the App's installation, permissions, and that GITHUB_APP_ID/GITHUB_APP_PRIVATE_KEY_BASE64 are correct.",
    );
    this.name = "InstallationTokenRequestFailedError";
  }
}

export type { FetchLike };

export interface MintInstallationTokenOptions {
  readonly appId: string;
  readonly privateKey: string;
  readonly installationId: string | number;
  /** The single repository this token is scoped to (`owner/name`). */
  readonly repository: string;
  /** The exact permission set requested, always a subset of the App's overall grant. */
  readonly permissions: Readonly<Record<string, string>>;
}

export interface InstallationToken {
  readonly token: string;
  readonly expiresAt: Date;
}

interface InstallationAccessTokenResponse {
  readonly token: string;
  readonly expires_at: string;
}

function isInstallationAccessTokenResponse(
  value: unknown,
): value is InstallationAccessTokenResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>)["token"] === "string" &&
    typeof (value as Record<string, unknown>)["expires_at"] === "string"
  );
}

/**
 * Mints a short-lived (max 1 hour, per GitHub) installation access token
 * scoped to exactly one repository and exactly the requested permissions —
 * always a subset of the App's overall installed permissions, never
 * broadened by this call. The App's own JWT (from `signAppJwt`) is used
 * only to authenticate this one request and is not returned to the caller.
 */
export async function mintInstallationToken(
  options: MintInstallationTokenOptions,
  fetchImpl: FetchLike = fetch,
): Promise<InstallationToken> {
  const appJwt = await signAppJwt({ appId: options.appId, privateKey: options.privateKey });
  // GitHub's `repositories` field on this endpoint takes bare repo names,
  // not `owner/name` — unlike almost every other GitHub API. Strip the
  // owner prefix from our own `owner/name`-shaped option before sending.
  const repositoryName = options.repository.split("/").at(-1) ?? options.repository;

  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchImpl(
      `https://api.github.com/app/installations/${encodeURIComponent(String(options.installationId))}/access_tokens`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": GITHUB_API_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repositories: [repositoryName],
          permissions: options.permissions,
        }),
        signal: AbortSignal.timeout(INSTALLATION_TOKEN_TIMEOUT_MS),
      },
    );
  } catch {
    throw new InstallationTokenRequestFailedError();
  }

  if (!response.ok) {
    throw new InstallationTokenRequestFailedError();
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new InstallationTokenRequestFailedError();
  }

  if (!isInstallationAccessTokenResponse(body)) {
    throw new InstallationTokenRequestFailedError();
  }

  return { token: body.token, expiresAt: new Date(body.expires_at) };
}
