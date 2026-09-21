import { NextResponse } from "next/server";

import { buildAuthorizeUrl } from "@/src/auth/github-oauth";
import { encodeOauthState, OAUTH_STATE_COOKIE_NAME, type OauthIntent } from "@/src/auth/session";
import { buildInstallUrl } from "@/src/github/install-url";

const OAUTH_STATE_MAX_AGE_SECONDS = 600;

export async function GET(request: Request): Promise<Response> {
  const clientId = process.env["GITHUB_APP_CLIENT_ID"];
  if (!clientId) {
    return NextResponse.json({ error: "GITHUB_APP_CLIENT_ID is not set." }, { status: 500 });
  }

  const url = new URL(request.url);
  const origin = url.origin;
  const intent: OauthIntent = url.searchParams.get("intent") === "provision-repo" ? "provision-repo" : "signin";
  const state = encodeOauthState(intent);

  // Plain sign-in only needs a user access token, so it goes straight to
  // GitHub's authorize screen. Provisioning needs the App actually
  // installed, which only the install URL triggers (see install-url.ts) —
  // with "Request user authorization during installation" enabled on the
  // App, completing that install still lands back on the same callback
  // with a `code`, so the rest of the flow is unchanged.
  const destination =
    intent === "provision-repo"
      ? buildInstallUrl({ state })
      : buildAuthorizeUrl({ clientId, redirectUri: `${origin}/api/auth/callback`, state });

  const response = NextResponse.redirect(destination);

  response.cookies.set(OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  });

  return response;
}
