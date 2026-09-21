const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const USER_URL = "https://api.github.com/user";

export interface GithubOauthUser {
  readonly login: string;
  readonly userId: number;
  readonly avatarUrl: string;
}

export function buildAuthorizeUrl(options: {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly state: string;
}): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("state", options.state);
  return url.toString();
}

/**
 * Exchanges an OAuth `code` for a short-lived GitHub user access token, used
 * once to read the caller's identity and then discarded — it is never
 * persisted. This is GitHub identity for the web UI itself, not a Codex/
 * Claude/other provider credential, so it isn't covered by (and doesn't
 * weaken) the "never store provider auth material" invariant.
 */
export async function exchangeCodeForAccessToken(options: {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly code: string;
  readonly redirectUri: string;
}): Promise<string> {
  const response = await fetch(ACCESS_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: options.clientId,
      client_secret: options.clientSecret,
      code: options.code,
      redirect_uri: options.redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error("GitHub OAuth token exchange failed.");
  }

  const body = (await response.json()) as { access_token?: unknown; error?: unknown };
  if (typeof body.access_token !== "string" || body.access_token === "") {
    throw new Error("GitHub OAuth token exchange returned no access token.");
  }
  return body.access_token;
}

export async function fetchGithubOauthUser(accessToken: string): Promise<GithubOauthUser> {
  const response = await fetch(USER_URL, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/vnd.github+json",
      "user-agent": "primetime-web",
    },
  });

  if (!response.ok) {
    throw new Error("Could not fetch the GitHub user profile.");
  }

  const body = (await response.json()) as { login?: unknown; id?: unknown; avatar_url?: unknown };
  if (typeof body.login !== "string" || typeof body.id !== "number") {
    throw new Error("Unexpected GitHub user profile response.");
  }

  return {
    login: body.login,
    userId: body.id,
    avatarUrl: typeof body.avatar_url === "string" ? body.avatar_url : "",
  };
}
