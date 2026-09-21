import {
  mintInstallationToken,
  verifyActionsOidcToken,
  type ActionsOidcClaims,
} from "@primetime/github-app";

import type { InstallationStore } from "../db/store";

/** The only permission a primer-refresh workflow needs from its installation token. */
const TOKEN_PERMISSIONS = { secrets: "write" } as const;

const BEARER_PREFIX = "Bearer ";

export interface HandleActionsTokenRequestOptions {
  readonly audience: string;
  readonly appId: string;
  readonly privateKey: string;
  readonly store: InstallationStore;
  readonly verifyToken?: typeof verifyActionsOidcToken;
  readonly mintToken?: typeof mintInstallationToken;
}

/**
 * The OIDC-to-installation-token exchange: a GitHub Actions runner proves
 * (via its signed OIDC token) which workflow run and repository it is, and
 * gets back an installation token scoped to exactly that one repository —
 * never broader. A repository with no matching installation gets nothing.
 * The Codex session itself never passes through this endpoint.
 */
export async function handleActionsTokenRequest(
  request: Request,
  options: HandleActionsTokenRequestOptions,
): Promise<Response> {
  const verifyToken = options.verifyToken ?? verifyActionsOidcToken;
  const mintToken = options.mintToken ?? mintInstallationToken;

  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith(BEARER_PREFIX)
    ? authHeader.slice(BEARER_PREFIX.length).trim()
    : undefined;

  if (!bearerToken) {
    return Response.json({ error: "missing bearer token" }, { status: 401 });
  }

  let claims: ActionsOidcClaims;
  try {
    claims = await verifyToken(bearerToken, { audience: options.audience });
  } catch {
    return Response.json({ error: "invalid token" }, { status: 401 });
  }

  const installation = await options.store.findInstallationForRepository(claims.repository);
  if (!installation) {
    return Response.json(
      { error: "no GitHub App installation found for this repository" },
      { status: 403 },
    );
  }

  try {
    const installationToken = await mintToken({
      appId: options.appId,
      privateKey: options.privateKey,
      installationId: installation.installationId,
      repository: claims.repository,
      permissions: TOKEN_PERMISSIONS,
    });

    return Response.json({
      token: installationToken.token,
      expiresAt: installationToken.expiresAt.toISOString(),
    });
  } catch {
    return Response.json({ error: "could not mint installation token" }, { status: 502 });
  }
}
